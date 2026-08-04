import type { Metadata } from "next";
import { listPublicCollections } from "@/lib/collections";
import { PublicCollectionsGrid } from "@/components/public-collections-grid";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FolderOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Explore public collections",
  description: "Browse public code snippet collections shared by the community.",
};

export default async function ExplorePage() {
  const collections = await listPublicCollections();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">DCodeBook</span>
          </Link>
          <Button render={<Link href="/sign-in" />}>
            Sign in to start sharing
          </Button>
        </header>

        <section className="mt-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Explore public collections
          </h1>
          <p className="text-muted-foreground">
            Browse public code snippet collections shared by the community.
          </p>
        </section>

        <section className="mt-8">
          <PublicCollectionsGrid collections={collections} />
        </section>
      </div>
    </main>
  );
}
