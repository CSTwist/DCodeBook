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

async function getOrCreateTagIds(tagNames: string[]): Promise<string[]> {
  const uniqueNames = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)));
  const tagIds: string[] = [];
  for (const name of uniqueNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
      select: { id: true },
    });
    tagIds.push(tag.id);
  }
  return tagIds;
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

  try {
    const tagIds = await getOrCreateTagIds(tagNames ?? []);
    const snippet = await prisma.snippet.create({
      data: {
        title,
        description,
        code,
        language,
        ownerId: user.id,
        collectionId: collectionId ?? null,
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/snippets");
    revalidatePath("/dashboard");
    revalidatePath("/sitemap.xml");
    if (collectionId) {
      revalidatePath(`/collections/${collectionId}`);
      revalidatePath(`/explore/${collectionId}`);
    }

    return { snippetId: snippet.id };
  } catch (err) {
    console.error("createSnippet error:", err);
    return { error: "INTERNAL" as const };
  }
}

export async function updateSnippet(id: string, formData: FormData) {
  const user = await requireUser();
  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.ownerId !== user.id) return { error: "FORBIDDEN" as const };

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

  try {
    const tagIds = await getOrCreateTagIds(tagNames ?? []);
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
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
    });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/snippets");
    revalidatePath("/dashboard");
    revalidatePath("/sitemap.xml");
    revalidatePath(`/snippets/${id}`);
    revalidatePath(`/explore/snippets/${id}`);
    if (existing.collectionId) {
      revalidatePath(`/collections/${existing.collectionId}`);
      revalidatePath(`/explore/${existing.collectionId}`);
    }
    const targetCollectionId = collectionId ?? null;
    if (targetCollectionId && targetCollectionId !== existing.collectionId) {
      revalidatePath(`/collections/${targetCollectionId}`);
      revalidatePath(`/explore/${targetCollectionId}`);
    }

    return { success: true as const };
  } catch (err) {
    console.error("updateSnippet error:", err);
    return { error: "INTERNAL" as const };
  }
}

export async function deleteSnippet(id: string) {
  const user = await requireUser();
  const existing = await prisma.snippet.findUnique({ where: { id } });
  if (!existing) return { error: "NOT_FOUND" as const };
  if (existing.ownerId !== user.id) return { error: "FORBIDDEN" as const };

  try {
    await prisma.snippet.delete({ where: { id } });

    revalidatePath("/");
    revalidatePath("/explore");
    revalidatePath("/snippets");
    revalidatePath("/dashboard");
    revalidatePath("/sitemap.xml");
    revalidatePath(`/snippets/${id}`);
    revalidatePath(`/explore/snippets/${id}`);
    if (existing.collectionId) {
      revalidatePath(`/collections/${existing.collectionId}`);
      revalidatePath(`/explore/${existing.collectionId}`);
    }

    return { success: true as const };
  } catch (err) {
    console.error("deleteSnippet error:", err);
    return { error: "INTERNAL" as const };
  }
}

