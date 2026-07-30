import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewCollection, canEditCollection } from "@/lib/rbac";
import { VisibilityBadge } from "@/components/visibility-badge";
import { CollectionMembers } from "@/components/collection-members";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({ where: { id } });
  if (!collection) return { title: "Collection not found" };
  return {
    title: collection.name,
    description: collection.description ?? undefined,
    ...(collection.visibility === "PUBLIC"
      ? {
          openGraph: {
            title: collection.name,
            description: collection.description ?? undefined,
            type: "website",
          },
        }
      : {}),
  };
}

export default async function CollectionPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, image: true } },
      snippets: {
        include: { tags: { include: { tag: true } } },
        orderBy: { updatedAt: "desc" },
      },
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  if (!collection) notFound();

  const canView = await canViewCollection(id, session?.user?.id);
  if (!canView) {
    if (!session?.user)
      redirect(
        `/sign-in?callbackUrl=${encodeURIComponent(`/collections/${id}`)}`
      );
    notFound();
  }

  const canEdit = session?.user?.id
    ? await canEditCollection(id, session.user.id)
    : false;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Collections", href: "/collections" },
          { label: collection.name },
        ]}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back to collections"
        render={<Link href="/collections" />}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <div className="flex items-center gap-3">
          <FolderOpen className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{collection.name}</h1>
          <VisibilityBadge visibility={collection.visibility} />
        </div>
        {collection.description && (
          <p className="mt-2 text-muted-foreground">{collection.description}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          by {collection.owner.name ?? "Unknown"}
        </p>
      </div>

      {collection.visibility === "TEAM" && (
        <CollectionMembers
          collectionId={id}
          members={collection.memberships}
          canEdit={canEdit}
        />
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Snippets</h2>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/snippets/new?collectionId=${id}`} />}
            >
              Add Snippet
            </Button>
          )}
        </div>

        {collection.snippets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No snippets in this collection yet. Add snippets from your library.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collection.snippets.map((snippet: { id: string; title: string; language: string; description: string | null; tags: Array<{ tag: { id: string; name: string } }> }) => (
              <Link key={snippet.id} href={`/snippets/${snippet.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">{snippet.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-2 text-sm text-muted-foreground">
                      {snippet.language}
                    </p>
                    {snippet.description && (
                      <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                        {snippet.description}
                      </p>
                    )}
                    {snippet.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {snippet.tags.slice(0, 3).map(({ tag: t }: { tag: { id: string; name: string } }) => (
                          <Badge key={t.id} variant="outline">
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
