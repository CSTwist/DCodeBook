import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { highlight } from "@/lib/highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { Breadcrumbs } from "@/components/breadcrumbs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ArrowLeft } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({ where: { id } });
  if (!snippet) return { title: "Snippet not found" };
  return {
    title: snippet.title,
    description: snippet.description ?? undefined,
    openGraph: {
      title: snippet.title,
      description: snippet.description ?? undefined,
      type: "article",
    },
  };
}

export default async function SnippetPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  const snippet = await prisma.snippet.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } }, collection: true },
  });

  if (!snippet) notFound();
  if (snippet.ownerId !== session?.user?.id) notFound();

  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const dark = themeCookie === "dark" || (!themeCookie && true); // default dark

  const html = await highlight(snippet.code, snippet.language, dark);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Snippets", href: "/snippets" },
          { label: snippet.title },
        ]}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to snippets"
          render={<Link href="/snippets" />}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{snippet.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{snippet.language}</span>
            {snippet.description && <><span>•</span><span>{snippet.description}</span></>}
          </div>
        </div>
        {snippet.ownerId === session?.user?.id && (
          <Button
            variant="outline"
            size="sm"
            aria-label="Edit snippet"
            render={<Link href={`/snippets/${snippet.id}/edit`} />}
          >
            <Pencil className="mr-2 h-4 w-4" />Edit
          </Button>
        )}
      </div>
      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippet.tags.map(({ tag }: { tag: { id: string; name: string } }) => (<Badge key={tag.id}>{tag.name}</Badge>))}
        </div>
      )}
      {snippet.collection && (
        <p className="text-sm text-muted-foreground">
          Collection: <Link href={`/collections/${snippet.collection.id}`} className="underline underline-offset-2 hover:text-foreground">{snippet.collection.name}</Link>
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
