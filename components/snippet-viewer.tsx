import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

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

interface SnippetViewerProps {
  snippet: {
    id: string;
    title: string;
    code: string;
    language: string;
    description?: string | null;
    tags: Array<{ tag: { id: string; name: string } }>;
    collection?: { id: string; name: string } | null;
    owner?: { name?: string | null; image?: string | null } | null;
  };
  html: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  backHref: string;
  collectionHrefPrefix?: string;
  actions?: React.ReactNode;
}

export function SnippetViewer({
  snippet,
  html,
  breadcrumbs,
  backHref,
  collectionHrefPrefix = "/collections",
  actions,
}: SnippetViewerProps) {
  return (
    <div className="space-y-6">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          render={<Link href={backHref} />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{snippet.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{snippet.language}</Badge>
            {snippet.description && (
              <>
                <span>•</span>
                <span>{snippet.description}</span>
              </>
            )}
            {snippet.owner && (
              <>
                <span>•</span>
                <div className="inline-flex items-center gap-1.5">
                  <Avatar size="sm" className="h-4 w-4">
                    {snippet.owner.image ? (
                      <AvatarImage src={snippet.owner.image} alt={snippet.owner.name ?? ""} />
                    ) : null}
                    <AvatarFallback className="text-[10px]">{initials(snippet.owner.name)}</AvatarFallback>
                  </Avatar>
                  <span>by {snippet.owner.name ?? "Unknown"}</span>
                </div>
              </>
            )}
          </div>
        </div>
        {actions}
      </div>

      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippet.tags.map(({ tag }) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
        </div>
      )}

      {snippet.collection && (
        <p className="text-sm text-muted-foreground">
          Collection:{" "}
          <Link
            href={`${collectionHrefPrefix}/${snippet.collection.id}`}
            className="underline underline-offset-2 hover:text-foreground font-medium"
          >
            {snippet.collection.name}
          </Link>
        </p>
      )}

      <CodeBlock
        code={snippet.code}
        html={html}
        className="overflow-x-auto rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-950"
      />
    </div>
  );
}
