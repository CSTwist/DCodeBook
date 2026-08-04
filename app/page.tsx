import type { Metadata } from "next";
import { listPublicCollections } from "@/lib/collections";
import { PublicCollectionsGrid } from "@/components/public-collections-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FolderOpen, Key, Braces, Tag, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "DCodeBook — Your code snippets, organized and shareable",
  description:
    "Save, tag, and share code across collections — private, team, or public. Highlighted with Shiki, searchable instantly.",
};

const features = [
  {
    title: "OAuth sign-in",
    description: "Authenticate securely with your favorite identity providers.",
    icon: Key,
  },
  {
    title: "Beautiful highlighting",
    description: "Syntax highlighting powered by Shiki across languages.",
    icon: Braces,
  },
  {
    title: "Tags + live search",
    description: "Filter and discover code snippets instantly using flexible tags.",
    icon: Tag,
  },
  {
    title: "Collections with roles",
    description: "Share code publicly, with your team, or keep it private.",
    icon: FolderOpen,
  },
];

export default async function Home() {
  const collections = await listPublicCollections(3);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <main id="main" className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <header className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">DCodeBook</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/explore"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Explore snippets
              </Link>
              <Button render={<Link href="/sign-in" />}>Sign in</Button>
            </div>
          </header>

          <section className="mt-12 space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Your code snippets, organized and shareable.
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Save, tag, and share code across collections — private, team, or
              public. Highlighted with Shiki, searchable instantly.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button render={<Link href="/explore" />}>
                Browse public snippets
              </Button>
              <Button variant="outline" render={<Link href="/sign-in" />}>
                Sign in
              </Button>
            </div>
          </section>

          <section className="mt-12 space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-center">
              Why DCodeBook?
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="h-full">
                    <CardHeader>
                      <Icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base mt-2">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

          <section className="mt-12 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">
                Featured public collections
              </h2>
              <Link
                href="/explore"
                className="group flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <PublicCollectionsGrid collections={collections} />
          </section>

          <footer className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
            DCodeBook — Built with Next.js, Prisma, and PostgreSQL.
          </footer>
        </div>
      </main>
    </>
  );
}
