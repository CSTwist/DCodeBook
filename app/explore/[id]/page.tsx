import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
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
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 10;

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

export default async function ExploreCollectionPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  const collection = await prisma.collection.findFirst({
    where: { id, visibility: "PUBLIC" },
    include: {
      owner: { select: { name: true, image: true } },
      _count: { select: { snippets: true } },
      snippets: {
        select: {
          id: true,
          title: true,
          language: true,
          description: true,
          tags: { select: { tag: { select: { id: true, name: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      },
    },
  });

  if (!collection) notFound();

  const totalSnippets = collection._count.snippets;
  const totalPages = Math.ceil(totalSnippets / PAGE_SIZE) || 1;

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
              {totalSnippets} snippet
              {totalSnippets !== 1 ? "s" : ""}
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
            <>
              {collection.snippets.map((snippet) => (
                <Card key={snippet.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/explore/snippets/${snippet.id}`} className="hover:underline">
                        <CardTitle className="text-base">{snippet.title}</CardTitle>
                      </Link>
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
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <Link
                        href={`/explore/snippets/${snippet.id}`}
                        className="text-primary underline-offset-4 hover:underline font-medium"
                      >
                        View full snippet
                      </Link>
                      <Link
                        href="/sign-in"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Sign in to save
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    render={page > 1 ? <Link href={`/explore/${id}?page=${page - 1}`} /> : undefined}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    render={page < totalPages ? <Link href={`/explore/${id}?page=${page + 1}`} /> : undefined}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
