import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPopularTags } from "@/lib/tags";
import { SearchBox } from "@/components/search-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteSnippetButton } from "@/components/delete-snippet-button";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}

export default async function SnippetsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) return null;

  const { q, tag, page } = await searchParams;
  const userId = session.user.id;

  const currentPage = Math.max(1, parseInt(page || "1", 10) || 1);
  const pageSize = 12;
  const skip = (currentPage - 1) * pageSize;

  const whereClause = {
    ownerId: userId,
    ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
            {
              tags: {
                some: {
                  tag: { name: { contains: q, mode: "insensitive" as const } },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [totalSnippets, snippets, tags] = await Promise.all([
    prisma.snippet.count({ where: whereClause }),
    prisma.snippet.findMany({
      where: whereClause,
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    getPopularTags(userId),
  ]);

  const totalPages = Math.ceil(totalSnippets / pageSize);

  function getPageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tag) params.set("tag", tag);
    if (p > 1) params.set("page", String(p));
    const queryString = params.toString();
    return `/snippets${queryString ? `?${queryString}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Snippets</h1>
          <p className="text-muted-foreground">
            {q ? `Search results for "${q}"` : "Browse and organize your code"}
          </p>
        </div>
        <Button render={<Link href="/snippets/new" />}>
          <Plus className="mr-2 h-4 w-4" />
          New Snippet
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <SearchBox />
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => (
              <Link key={t.id} href={`/snippets?tag=${t.name}`}>
                <Badge variant={tag === t.name ? "default" : "secondary"}>
                  {t.name}
                </Badge>
              </Link>
            ))}
            {tag && (
              <Link href="/snippets">
                <Badge variant="outline">Clear</Badge>
              </Link>
            )}
          </div>
        )}
      </div>

      {snippets.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {q
              ? `No snippets matching "${q}"`
              : "No snippets yet. Create your first one!"}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snippets.map((snippet) => (
              <div key={snippet.id} className="relative group">
                <Link href={`/snippets/${snippet.id}`} className="block h-full">
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 pr-6">
                        <CardTitle className="text-base">{snippet.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
                        {snippet.language}
                        {snippet.description && ` — ${snippet.description}`}
                      </p>
                      {snippet.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {snippet.tags.map(({ tag: t }) => (
                            <Badge key={t.id} variant="outline">
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                {snippet.ownerId === userId && (
                  <div className="absolute top-3 right-3 z-10">
                    <DeleteSnippetButton snippetId={snippet.id} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {skip + 1} to {Math.min(skip + pageSize, totalSnippets)} of{" "}
                {totalSnippets} snippets
              </p>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={getPageUrl(currentPage - 1)} />}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                )}

                <span className="text-sm px-2">
                  {currentPage} / {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={getPageUrl(currentPage + 1)} />}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
