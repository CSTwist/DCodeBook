import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Code2, FolderOpen, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  const [recentSnippets, snippetCount, collectionCount] = await Promise.all([
    prisma.snippet.findMany({
      where: { ownerId: userId },
      include: { tags: { include: { tag: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.snippet.count({ where: { ownerId: userId } }),
    prisma.collection.count({ where: { ownerId: userId } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {session.user.name ?? "Developer"}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Snippets</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{snippetCount}</p>
            <Link href="/snippets" className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
            <Link href="/collections" className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Snippets</h2>
          <Link href="/snippets" className="text-sm text-muted-foreground hover:text-foreground">View all</Link>
        </div>
        {recentSnippets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No snippets yet.{" "}
              <Link href="/snippets/new" className="text-primary hover:underline">Create your first snippet</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentSnippets.map((snippet) => (
              <Link key={snippet.id} href={`/snippets/${snippet.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{snippet.title}</p>
                      <p className="text-sm text-muted-foreground">{snippet.language}</p>
                    </div>
                    <div className="flex gap-1">
                      {snippet.tags.slice(0, 3).map(({ tag }) => (
                        <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
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
