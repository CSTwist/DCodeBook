import { prisma } from "@/lib/prisma";

export async function listVisibleCollections(userId: string) {
  return prisma.collection.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { visibility: "PUBLIC" },
        { visibility: "TEAM", memberships: { some: { userId } } },
      ],
    },
    include: { _count: { select: { snippets: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listPublicCollections() {
  return prisma.collection.findMany({
    where: { visibility: "PUBLIC" },
    include: { _count: { select: { snippets: true } } },
    orderBy: { updatedAt: "desc" },
  });
}
