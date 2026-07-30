import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SnippetForm } from "@/components/snippet-form";

export default async function NewSnippetPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  const collections = await prisma.collection.findMany({
    where: { ownerId: session.user.id },
    select: { id: true, name: true },
  });
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">New Snippet</h1>
      <SnippetForm collections={collections} />
    </div>
  );
}
