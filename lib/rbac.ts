import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function canEditCollection(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: { memberships: { where: { userId } } },
  });
  if (!collection) return false;
  if (collection.ownerId === userId) return true;
  const m = collection.memberships[0];
  return m?.role === "EDITOR" || m?.role === "ADMIN";
}

export async function canManageCollectionMembers(collectionId: string, userId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: { memberships: { where: { userId } } },
  });
  if (!collection) return false;
  if (collection.ownerId === userId) return true;
  const m = collection.memberships[0];
  return m?.role === "ADMIN";
}


export async function canViewCollection(collectionId: string, userId?: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: userId ? { memberships: { where: { userId } } } : undefined,
  });
  if (!collection) return false;
  if (collection.visibility === "PUBLIC") return true;
  if (!userId) return false;
  if (collection.ownerId === userId) return true;
  const m = (collection as { memberships?: { role: string }[] }).memberships?.[0];
  return m?.role === "VIEWER" || m?.role === "EDITOR" || m?.role === "ADMIN";
}
