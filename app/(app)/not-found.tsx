import { Button } from "@/components/ui/button";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4 py-12">
      <div className="rounded-full bg-muted p-4 text-muted-foreground mb-4">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        The requested resource, snippet, or collection could not be found or you do not have permission to view it.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="default" render={<Link href="/dashboard" />}>
          <Home className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <Button variant="outline" render={<Link href="/snippets" />}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Snippets
        </Button>
      </div>
    </div>
  );
}
