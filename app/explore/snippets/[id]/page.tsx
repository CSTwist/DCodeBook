import type { Metadata } from "next";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { highlight } from "@/lib/highlight";
import { SnippetViewer } from "@/components/snippet-viewer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const snippet = await prisma.snippet.findFirst({
    where: { id, collection: { visibility: "PUBLIC" } },
    select: { title: true, description: true },
  });
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

export default async function ExploreSnippetPage({ params }: Props) {
  const { id } = await params;

  const snippet = await prisma.snippet.findFirst({
    where: {
      id,
      collection: { visibility: "PUBLIC" },
    },
    include: {
      tags: { include: { tag: true } },
      collection: { select: { id: true, name: true, visibility: true } },
      owner: { select: { name: true, image: true } },
    },
  });

  if (!snippet) notFound();

  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const dark = themeCookie === "dark";

  const html = await highlight(snippet.code, snippet.language, dark);

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <SnippetViewer
          snippet={snippet}
          html={html}
          backHref={snippet.collection ? `/explore/${snippet.collection.id}` : "/"}
          collectionHrefPrefix="/explore"
          actions={
            <Button render={<Link href="/sign-in" />}>
              Sign in to start sharing
            </Button>
          }
        />
      </div>
    </main>
  );
}
