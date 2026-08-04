"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canEditCollection, canManageCollectionMembers } from "@/lib/rbac";
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

  try {
    const collection = await prisma.collection.create({
      data: { name, description, visibility, ownerId: user.id },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/collections");
    revalidatePath("/dashboard");
    revalidatePath("/sitemap.xml");
    return { collectionId: collection.id };
  } catch (err) {
    console.error("createCollection error:", err);
    return { error: "INTERNAL" as const };
  }
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

  try {
    await prisma.collection.update({
      where: { id },
      data: { name, description, visibility },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/dashboard");
    revalidatePath("/collections");
    revalidatePath("/sitemap.xml");
    revalidatePath(`/collections/${id}`);
    revalidatePath(`/explore/${id}`);
    return { success: true as const };
  } catch (err) {
    console.error("updateCollection error:", err);
    return { error: "INTERNAL" as const };
  }
}

export async function deleteCollection(id: string) {
  const user = await requireUser();
  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.ownerId !== user.id) return { error: "FORBIDDEN" as const };

  try {
    await prisma.collection.delete({ where: { id } });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/dashboard");
    revalidatePath("/collections");
    revalidatePath("/sitemap.xml");
    revalidatePath(`/collections/${id}`);
    revalidatePath(`/explore/${id}`);
    return { success: true as const };
  } catch (err) {
    console.error("deleteCollection error:", err);
    return { error: "INTERNAL" as const };
  }
}

export async function addMember(collectionId: string, formData: FormData) {
  const user = await requireUser();
  const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return { error: "NOT_FOUND" as const };

  const canManage = await canManageCollectionMembers(collectionId, user.id);
  if (!canManage) return { error: "FORBIDDEN" as const };

  const email = formData.get("email");
  const role = formData.get("role");
  if (!email || typeof email !== "string") return { error: "Email required" };
  if (!role || typeof role !== "string") return { error: "Role required" };

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return { error: "User not found" };

  if (target.id === collection.ownerId) {
    return { error: "Collection owner is already a member" };
  }

  const parsed = memberSchema.safeParse({ userId: target.id, role });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }

  try {
    await prisma.membership.upsert({
      where: { userId_collectionId: { userId: target.id, collectionId } },
      update: { role: parsed.data.role },
      create: { userId: target.id, collectionId, role: parsed.data.role },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath(`/collections/${collectionId}`);
    revalidatePath(`/explore/${collectionId}`);
    return { success: true as const };
  } catch (err) {
    console.error("addMember error:", err);
    return { error: "INTERNAL" as const };
  }
}

export async function updateMemberRole(
  collectionId: string,
  targetUserId: string,
  role: string
) {
  const user = await requireUser();
  const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return { error: "NOT_FOUND" as const };

  const canManage = await canManageCollectionMembers(collectionId, user.id);
  if (!canManage) return { error: "FORBIDDEN" as const };

  if (targetUserId === collection.ownerId) {
    return { error: "Cannot modify collection owner role" };
  }

  if (targetUserId === user.id) {
    return { error: "Cannot modify your own role" };
  }

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_collectionId: { userId: targetUserId, collectionId } },
  });
  if (!existingMembership) {
    return { error: "Member not found" };
  }

  const parsed = memberSchema.safeParse({ userId: targetUserId, role });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }

  try {
    await prisma.membership.update({
      where: { userId_collectionId: { userId: targetUserId, collectionId } },
      data: { role: parsed.data.role },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath(`/collections/${collectionId}`);
    revalidatePath(`/explore/${collectionId}`);
    return { success: true as const };
  } catch (err) {
    console.error("updateMemberRole error:", err);
    return { error: "INTERNAL" as const };
  }
}

export async function removeMember(collectionId: string, userId: string) {
  const user = await requireUser();
  const collection = await prisma.collection.findUnique({ where: { id: collectionId } });
  if (!collection) return { error: "NOT_FOUND" as const };

  const canManage = await canManageCollectionMembers(collectionId, user.id);
  if (!canManage) return { error: "FORBIDDEN" as const };

  if (userId === collection.ownerId) {
    return { error: "Cannot remove collection owner" };
  }

  if (userId === user.id) {
    return { error: "Cannot remove yourself" };
  }

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_collectionId: { userId, collectionId } },
  });
  if (!existingMembership) {
    return { error: "Member not found" };
  }

  try {
    await prisma.membership.delete({
      where: { userId_collectionId: { userId, collectionId } },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath(`/collections/${collectionId}`);
    revalidatePath(`/explore/${collectionId}`);
    return { success: true as const };
  } catch (err) {
    console.error("removeMember error:", err);
    return { error: "INTERNAL" as const };
  }
}

