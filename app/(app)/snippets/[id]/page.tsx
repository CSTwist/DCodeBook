import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewCollection } from "@/lib/rbac";
import { highlight } from "@/lib/highlight";
import { SnippetViewer } from "@/components/snippet-viewer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await auth();
  const { id } = await params;
  const userId = session?.user?.id;

  const snippet = await prisma.snippet.findFirst({
    where: {
      id,
      ...(userId
        ? {
            OR: [
              { collection: { visibility: "PUBLIC" } },
              { ownerId: userId },
              { collection: { ownerId: userId } },
              { collection: { memberships: { some: { userId } } } },
            ],
          }
        : {
            collection: { visibility: "PUBLIC" },
          }),
    },
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

export default async function SnippetPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;

  const snippet = await prisma.snippet.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      collection: { select: { id: true, name: true } },
      owner: { select: { name: true, image: true } },
    },
  });

  if (!snippet) notFound();

  let canView = false;
  if (snippet.collectionId) {
    canView = await canViewCollection(snippet.collectionId, session?.user?.id);
  } else {
    canView = Boolean(session?.user?.id && snippet.ownerId === session.user.id);
  }

  if (!canView) notFound();

  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const dark = themeCookie === "dark";

  const html = await highlight(snippet.code, snippet.language, dark);

  const isOwner = session?.user?.id === snippet.ownerId;

  return (
    <SnippetViewer
      snippet={snippet}
      html={html}
      breadcrumbs={[
        { label: "Snippets", href: "/snippets" },
        { label: snippet.title },
      ]}
      backHref={snippet.collection ? `/collections/${snippet.collection.id}` : "/snippets"}
      collectionHrefPrefix="/collections"
      actions={
        isOwner ? (
          <Button
            variant="outline"
            size="sm"
            aria-label="Edit snippet"
            render={<Link href={`/snippets/${snippet.id}/edit`} />}
          >
            <Pencil className="mr-2 h-4 w-4" />Edit
          </Button>
        ) : null
      }
    />
  );
}
