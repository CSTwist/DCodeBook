import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { Code2, FolderOpen, Tags, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  const [
    recentSnippets,
    snippetCount,
    collectionCount,
    tagCount,
    languageBreakdown,
    popularTagAgg,
  ] = await Promise.all([
    prisma.snippet.findMany({
      where: { ownerId: userId },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.snippet.count({ where: { ownerId: userId } }),
    prisma.collection.count({ where: { ownerId: userId } }),
    prisma.tag.count({
      where: { snippets: { some: { snippet: { ownerId: userId } } } },
    }),
    prisma.snippet.groupBy({
      by: ["language"],
      where: { ownerId: userId },
      _count: { language: true },
      orderBy: { _count: { language: "desc" } },
    }),
    prisma.snippetTag.groupBy({
      by: ["tagId"],
      where: { snippet: { ownerId: userId } },
      _count: { tagId: true },
      orderBy: { _count: { tagId: "desc" } },
      take: 8,
    }),
  ]);

  const tagIds = popularTagAgg.map((t) => t.tagId);
  const tagRecords = await prisma.tag.findMany({ where: { id: { in: tagIds } } });
  const popularTags = popularTagAgg
    .map((agg) => {
      const tag = tagRecords.find((t) => t.id === agg.tagId);
      return tag ? { id: tag.id, name: tag.name, count: agg._count.tagId } : null;
    })
    .filter(
      (t): t is { id: string; name: string; count: number } => t !== null,
    );

  const totalLanguageCount = languageBreakdown.reduce(
    (sum, l) => sum + l._count.language,
    0,
  );
  const maxTagCount =
    popularTags.length > 0 ? Math.max(...popularTags.map((t) => t.count)) : 0;
  const minTagCount =
    popularTags.length > 0 ? Math.min(...popularTags.map((t) => t.count)) : 0;

  const barColors = [
    "bg-primary",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-orange-500",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name ?? "Developer"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Snippets</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{snippetCount}</p>
            <Link
              href="/snippets"
              className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Collections</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{collectionCount}</p>
            <Link
              href="/collections"
              className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tagCount}</p>
            <Link
              href="/snippets"
              className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Browse by tag <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Languages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {languageBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No snippets yet.</p>
            ) : (
              languageBreakdown.map((lang, i) => {
                const percent =
                  totalLanguageCount > 0
                    ? (lang._count.language / totalLanguageCount) * 100
                    : 0;
                return (
                  <div key={lang.language} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{lang.language}</span>
                      <span className="text-muted-foreground">
                        {lang._count.language}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted">
                      <div
                        className={`h-2 rounded ${barColors[i % barColors.length]}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Popular Tags</CardTitle>
          </CardHeader>
          <CardContent>
            {popularTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {popularTags.map((tag) => {
                  const range = maxTagCount - minTagCount || 1;
                  const scale = (tag.count - minTagCount) / range;
                  const fontSize = 0.75 + scale * 0.75;
                  return (
                    <Link
                      key={tag.id}
                      href={`/snippets?tag=${encodeURIComponent(tag.name)}`}
                    >
                      <Badge
                        variant="secondary"
                        style={{ fontSize: `${fontSize}rem` }}
                      >
                        {tag.name}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Snippets</h2>
          <Link
            href="/snippets"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        </div>
        {recentSnippets.length === 0 ? (
          <EmptyState
            icon={Code2}
            title="No snippets yet"
            description="Create your first code snippet to see it here."
            actionLabel="New Snippet"
            actionHref="/snippets/new"
          />
        ) : (
          <div className="space-y-2">
            {recentSnippets.map((snippet) => (
              <Link key={snippet.id} href={`/snippets/${snippet.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{snippet.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {snippet.language}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {snippet.tags.slice(0, 3).map(({ tag }) => (
                        <Badge key={tag.id} variant="secondary">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
