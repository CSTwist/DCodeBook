import { auth } from "@/lib/auth";
import { listVisibleCollections } from "@/lib/collections";
import { VisibilityBadge } from "@/components/visibility-badge";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCollectionDialog } from "@/components/new-collection-dialog";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

export default async function CollectionsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const collections = await listVisibleCollections(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Collections</h1>
          <p className="text-muted-foreground">
            Browse your collections and public collections from the community
          </p>
        </div>
        <NewCollectionDialog />
      </div>

      {collections.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No collections yet"
          description="Group your snippets into collections."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((col: { id: string; name: string; visibility: "PUBLIC" | "PRIVATE" | "TEAM"; _count: { snippets: number } }) => (
            <Link key={col.id} href={`/collections/${col.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{col.name}</CardTitle>
                    </div>
                    <VisibilityBadge visibility={col.visibility} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {col._count.snippets} snippet
                    {col._count.snippets !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
