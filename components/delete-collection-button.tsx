"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCollection } from "@/actions/collections";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DeleteCollectionButton({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteCollection(collectionId);
      if (res?.error) {
        toast.error(typeof res.error === "string" ? res.error : "Failed to delete collection");
      } else {
        toast.success("Collection deleted");
        setOpen(false);
        router.push("/collections");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" aria-label="Delete collection">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete collection</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this collection? This action cannot be undone.
            Snippets in this collection will become standalone because schema uses SetNull.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            type="button"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
