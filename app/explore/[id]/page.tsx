import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { highlight } from "@/lib/highlight";
import { VisibilityBadge } from "@/components/visibility-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, visibility: "PUBLIC" },
    select: { name: true, description: true },
  });
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.name,
    description: collection.description ?? undefined,
    openGraph: {
      title: collection.name,
      description: collection.description ?? undefined,
      type: "website",
    },
  };
}

export default async function ExploreCollectionPage({ params }: Props) {
  const { id } = await params;

  const collection = await prisma.collection.findFirst({
    where: { id, visibility: "PUBLIC" },
    include: {
      owner: { select: { name: true, image: true } },
      _count: { select: { snippets: true } },
      snippets: {
        include: { tags: { include: { tag: true } } },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!collection) notFound();

  const previews = await Promise.all(
    collection.snippets.map(async (snippet: { id: string; title: string; code: string; language: string; description: string | null; tags: Array<{ tag: { id: string; name: string } }> }) => ({
      snippet,
      html: await highlight(snippet.code.slice(0, 500), snippet.language, true),
    }))
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" render={<Link href="/" />}>
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Button>
          <Button render={<Link href="/sign-in" />}>
            Sign in to start sharing
          </Button>
        </header>

        <section className="mt-8">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6" />
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            <VisibilityBadge visibility={collection.visibility} />
          </div>
          {collection.description && (
            <p className="mt-2 text-muted-foreground">{collection.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <Avatar size="sm">
              {collection.owner.image ? (
                <AvatarImage
                  src={collection.owner.image}
                  alt={collection.owner.name ?? ""}
                />
              ) : null}
              <AvatarFallback>{initials(collection.owner.name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              by {collection.owner.name ?? "Unknown"}
            </span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">
              {collection._count.snippets} snippet
              {collection._count.snippets !== 1 ? "s" : ""}
            </span>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          {collection.snippets.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                This collection is empty.
              </CardContent>
            </Card>
          ) : (
            previews.map(({ snippet, html }) => (
              <Card key={snippet.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{snippet.title}</CardTitle>
                    <Badge variant="outline">{snippet.language}</Badge>
                  </div>
                  {snippet.description && (
                    <p className="text-sm text-muted-foreground">
                      {snippet.description}
                    </p>
                  )}
                  {snippet.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {snippet.tags.map(({ tag: t }: { tag: { id: string; name: string } }) => (
                        <Badge key={t.id} variant="secondary">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div
                    className="overflow-hidden rounded-lg text-sm [&_pre]:overflow-x-auto [&_pre]:p-3"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing a preview.{" "}
                    <Link
                      href="/sign-in"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      Sign in to save this snippet
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
