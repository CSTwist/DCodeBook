"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSnippet } from "@/actions/snippets";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export function DeleteSnippetButton({ snippetId }: { snippetId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this snippet? This action cannot be undone.")) return;
    startTransition(async () => {
      const res = await deleteSnippet(snippetId);
      if (res?.error) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete snippet");
      } else {
        toast.success("Snippet deleted");
        router.refresh();
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleDelete}
      disabled={isPending}
      aria-label="Delete snippet"
    >
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
    </Button>
  );
}
