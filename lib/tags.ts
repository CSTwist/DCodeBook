import { prisma } from "@/lib/prisma";

export async function getPopularTags(userId: string, limit = 20) {
  return prisma.tag.findMany({
    where: { snippets: { some: { snippet: { ownerId: userId } } } },
    orderBy: { snippets: { _count: "desc" } },
    take: limit,
  });
}
