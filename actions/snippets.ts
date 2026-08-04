"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canEditCollection } from "@/lib/rbac";
import { snippetSchema } from "@/lib/validations";
import { revalidatePath } from "next/cache";

type FieldErrors = Record<string, string[]>;

function parseSnippetForm(formData: FormData) {
  const tagNames = formData
    .getAll("tagNames")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const collectionId = formData.get("collectionId");
  const description = formData.get("description");
  return {
    title: formData.get("title") ?? "",
    description: description ? String(description) : undefined,
    code: formData.get("code") ?? "",
    language: formData.get("language") ?? "",
    tagNames: tagNames.length > 0 ? tagNames : undefined,
    collectionId: collectionId ? String(collectionId) : null,
  };
}

export async function createSnippet(formData: FormData) {
  const user = await requireUser();
  const parsed = snippetSchema.safeParse(parseSnippetForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }
  const { title, description, code, language, tagNames, collectionId } = parsed.data;

  if (collectionId) {
    const canEdit = await canEditCollection(collectionId, user.id);
    if (!canEdit) {
      return { error: { collectionId: ["Unauthorized or collection does not exist"] } as unknown as FieldErrors };
    }
  }

  const snippet = await prisma.snippet.create({
    data: {
      title,
      description,
      code,
      language,
      ownerId: user.id,
      collectionId: collectionId ?? null,
      tags: {
        create: (tagNames ?? []).map((name) => ({
          tag: { connectOrCreate: { where: { name }, create: { name } } },
        })),
      },
    },
  });

  revalidatePath("/snippets");
  revalidatePath("/dashboard");
  return { snippetId: snippet.id };
}

export async function updateSnippet(id: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  const canEditExisting =
    existing.ownerId === user.id ||
    (existing.collectionId !== null &&
      (await canEditCollection(existing.collectionId, user.id)));
  if (!canEditExisting) return { error: "FORBIDDEN" as const };

  const parsed = snippetSchema.safeParse(parseSnippetForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors as unknown as FieldErrors };
  }
  const { title, description, code, language, tagNames, collectionId } = parsed.data;

  if (collectionId) {
    const canEdit = await canEditCollection(collectionId, user.id);
    if (!canEdit) {
      return { error: { collectionId: ["Unauthorized or collection does not exist"] } as unknown as FieldErrors };
    }
  }

  await prisma.snippet.update({
    where: { id },
    data: {
      title,
      description,
      code,
      language,
      collectionId: collectionId ?? null,
      tags: {
        deleteMany: {},
        create: (tagNames ?? []).map((name) => ({
          tag: { connectOrCreate: { where: { name }, create: { name } } },
        })),
      },
    },
  });

  revalidatePath("/snippets");
  revalidatePath(`/snippets/${id}`);
  return { success: true as const };
}

export async function deleteSnippet(id: string) {
  const user = await requireUser();
  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.ownerId !== user.id) return { error: "FORBIDDEN" as const };

  await prisma.snippet.delete({ where: { id } });
  revalidatePath("/snippets");
  revalidatePath("/dashboard");
  return { success: true as const };
}
