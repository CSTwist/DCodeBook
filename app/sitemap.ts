import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/explore`, lastModified: new Date() },
  ];

  try {
    const publicSnippets = await prisma.snippet.findMany({
      where: { collection: { visibility: "PUBLIC" } },
      select: { id: true, updatedAt: true },
    });

    const publicCollections = await prisma.collection.findMany({
      where: { visibility: "PUBLIC" },
      select: { id: true, updatedAt: true },
    });

    return [
      ...staticEntries,
      ...publicCollections.map((c) => ({
        url: `${baseUrl}/explore/${c.id}`,
        lastModified: c.updatedAt,
      })),
      ...publicSnippets.map((s) => ({
        url: `${baseUrl}/explore/snippets/${s.id}`,
        lastModified: s.updatedAt,
      })),
    ];
  } catch (error) {
    console.error("[sitemap] Failed to fetch dynamic routes from database:", error);
    return staticEntries;
  }
}
