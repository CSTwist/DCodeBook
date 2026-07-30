import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const publicSnippets = await prisma.snippet.findMany({
    where: { collection: { visibility: "PUBLIC" } },
    select: { id: true, updatedAt: true },
  });

  const publicCollections = await prisma.collection.findMany({
    where: { visibility: "PUBLIC" },
    select: { id: true, updatedAt: true },
  });

  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/sign-in`, lastModified: new Date() },
    ...publicCollections.map((c) => ({
      url: `${baseUrl}/collections/${c.id}`,
      lastModified: c.updatedAt,
    })),
    ...publicSnippets.map((s) => ({
      url: `${baseUrl}/snippets/${s.id}`,
      lastModified: s.updatedAt,
    })),
  ];
}
