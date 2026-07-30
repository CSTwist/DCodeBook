import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { SnippetForm } from "@/components/snippet-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Props { params: Promise<{ id: string }> }

export default async function EditSnippetPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const { id } = await params;
  const snippet = await prisma.snippet.findUnique({
    where: { id },
    include: { tags: { include: { tag: true } } },
  });
  if (!snippet || snippet.ownerId !== session.user.id) notFound();

  const collections = await prisma.collection.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="icon" render={<Link href="/snippets" />}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="text-2xl font-bold">Edit Snippet</h1>
      <SnippetForm
        snippet={{
          id: snippet.id,
          title: snippet.title,
          description: snippet.description,
          code: snippet.code,
          language: snippet.language,
          collectionId: snippet.collectionId,
          tags: snippet.tags.map((t) => ({ tag: { name: t.tag.name } })),
        }}
        collections={collections}
      />
    </div>
  );
}
