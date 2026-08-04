import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPopularTags } from "@/lib/tags";
import { SnippetForm } from "@/components/snippet-form";

export default async function NewSnippetPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const { collectionId } = await searchParams;
  const collections = await prisma.collection.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        {
          visibility: "TEAM",
          memberships: {
            some: {
              userId: session.user.id,
              role: { in: ["EDITOR", "ADMIN"] },
            },
          },
        },
      ],
    },
    select: { id: true, name: true },
  });
  const defaultCollectionId = collections.some((c) => c.id === collectionId)
    ? collectionId
    : undefined;
  const allTags = await getPopularTags(session.user.id);
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Snippet</h1>
      <SnippetForm
        collections={collections}
        allTags={allTags}
        defaultCollectionId={defaultCollectionId}
      />
    </div>
  );
}
