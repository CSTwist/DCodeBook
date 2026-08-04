"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CollectionForm } from "@/components/collection-form";
import { Pencil } from "lucide-react";

interface CollectionProp {
  id: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC" | "TEAM";
}

export function EditCollectionDialog({ collection }: { collection: CollectionProp }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" aria-label="Edit collection">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Collection</DialogTitle>
        </DialogHeader>
        <CollectionForm collection={collection} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
