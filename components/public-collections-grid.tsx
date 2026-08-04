import { listPublicCollections } from "@/lib/collections";
import { VisibilityBadge } from "@/components/visibility-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

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

interface PublicCollectionsGridProps {
  collections: Awaited<ReturnType<typeof listPublicCollections>>;
}

export function PublicCollectionsGrid({ collections }: PublicCollectionsGridProps) {
  if (collections.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No public collections yet. Sign in to create and share your own!
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((col) => (
        <Link key={col.id} href={`/explore/${col.id}`}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{col.name}</CardTitle>
                </div>
                <VisibilityBadge visibility={col.visibility} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {col._count.snippets} snippet
                {col._count.snippets !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  {col.owner.image ? (
                    <AvatarImage src={col.owner.image} alt={col.owner.name ?? ""} />
                  ) : null}
                  <AvatarFallback>{initials(col.owner.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  {col.owner.name ?? "Unknown"}
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
