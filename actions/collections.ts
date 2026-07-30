"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canEditCollection } from "@/lib/rbac";
import { collectionSchema, memberSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

type FieldErrors = Record<string, string[]>;

function parseCollectionForm(formData: FormData) {
  const description = formData.get("description");
  return {
    name: formData.get("name") ?? "",
    description: description ? String(description) : undefined,
    visibility: (formData.get("visibility") as string) ?? "PRIVATE",
  };
}

export async function createCollection(formData: FormData) {
  const user = await requireUser();
  const parsed = collectionSchema.safeParse(parseCollectionForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }
  const { name, description, visibility } = parsed.data;

  const collection = await prisma.collection.create({
    data: { name, description, visibility, ownerId: user.id },
  });

  revalidatePath("/collections");
  return { collectionId: collection.id };
}

export async function updateCollection(id: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const canEdit = await canEditCollection(id, user.id);
  if (!canEdit) return { error: "FORBIDDEN" as const };

  const parsed = collectionSchema.safeParse(parseCollectionForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }
  const { name, description, visibility } = parsed.data;

  await prisma.collection.update({
    where: { id },
    data: { name, description, visibility },
  });

  revalidatePath("/collections");
  revalidatePath(`/collections/${id}`);
  return { success: true as const };
}

export async function deleteCollection(id: string) {
  const user = await requireUser();
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.ownerId !== user.id) return { error: "FORBIDDEN" as const };

  await prisma.collection.delete({ where: { id } });
  revalidatePath("/collections");
  return { success: true as const };
}

export async function addMember(collectionId: string, formData: FormData) {
  const user = await requireUser();
  const canEdit = await canEditCollection(collectionId, user.id);
  if (!canEdit) return { error: "FORBIDDEN" as const };

  const email = formData.get("email");
  const role = formData.get("role");
  if (!email || typeof email !== "string") return { error: "Email required" };
  if (!role || typeof role !== "string") return { error: "Role required" };

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return { error: "User not found" };

  const parsed = memberSchema.safeParse({ userId: target.id, role });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }

  await prisma.membership.upsert({
    where: { userId_collectionId: { userId: target.id, collectionId } },
    update: { role: parsed.data.role },
    create: { userId: target.id, collectionId, role: parsed.data.role },
  });

  revalidatePath(`/collections/${collectionId}`);
  return { success: true as const };
}

export async function removeMember(collectionId: string, userId: string) {
  const user = await requireUser();
  const canEdit = await canEditCollection(collectionId, user.id);
  if (!canEdit) return { error: "FORBIDDEN" as const };

  await prisma.membership.deleteMany({ where: { collectionId, userId } });
  revalidatePath(`/collections/${collectionId}`);
  return { success: true as const };
}
