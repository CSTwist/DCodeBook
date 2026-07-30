import { prisma } from "@/lib/prisma";

export async function searchSnippets(userId: string, term: string) {
  return prisma.snippet.findMany({
    where: {
      ownerId: userId,
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: term, mode: "insensitive" } } } } },
      ],
    },
    include: { tags: { include: { tag: true } } },
    take: 50,
    orderBy: { updatedAt: "desc" },
  });
}
