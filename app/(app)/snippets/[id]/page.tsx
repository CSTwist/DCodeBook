import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { highlight } from "@/lib/highlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const html = await highlight(snippet.code, snippet.language, false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" render={<Link href="/snippets" />}>
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
          <Button variant="outline" size="sm" render={<Link href={`/snippets/${snippet.id}/edit`} />}>
            <Pencil className="mr-2 h-4 w-4" />Edit
          </Button>
        )}
      </div>
      {snippet.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snippet.tags.map(({ tag }) => (<Badge key={tag.id}>{tag.name}</Badge>))}
        </div>
      )}
      {snippet.collection && (
        <p className="text-sm text-muted-foreground">
          Collection: <Link href={`/collections/${snippet.collection.id}`} className="underline underline-offset-2 hover:text-foreground">{snippet.collection.name}</Link>
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border bg-[#0d1117] p-4" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
