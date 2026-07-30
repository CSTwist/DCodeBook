"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { collectionSchema, type CollectionInput } from "@/lib/validations";
import { createCollection, updateCollection } from "@/actions/collections";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface CollectionProp {
  id: string;
  name: string;
  description?: string | null;
  visibility: "PRIVATE" | "PUBLIC" | "TEAM";
}

interface CollectionFormProps {
  collection?: CollectionProp;
  onSuccess?: () => void;
}

export function CollectionForm({ collection, onSuccess }: CollectionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CollectionInput>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: collection?.name ?? "",
      description: collection?.description ?? "",
      visibility: collection?.visibility ?? "PRIVATE",
    },
  });

  function onSubmit(values: CollectionInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("name", values.name);
      if (values.description) {
        formData.append("description", values.description);
      }
      formData.append("visibility", values.visibility);

      try {
        if (collection) {
          const res = await updateCollection(collection.id, formData);
          if (res?.error) {
            toast.error(typeof res.error === "string" ? res.error : "Failed to update collection");
          } else {
            toast.success("Collection updated successfully");
            if (onSuccess) onSuccess();
            router.refresh();
          }
        } else {
          const res = await createCollection(formData) as Record<string, unknown> | undefined;
          if (res && "error" in res) {
            toast.error(typeof res.error === "string" ? (res.error as string) : "Failed to create collection");
          } else if (res && "collectionId" in res) {
            toast.success("Collection created successfully");
            if (onSuccess) onSuccess();
            router.refresh();
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "An error occurred");
      }
    });
  }

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Collection Name</FormLabel>
            <FormControl>
              <Input placeholder="e.g., React Hooks & Utilities" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea placeholder="Optional description..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="visibility"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Visibility</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIVATE">Private (Only you)</SelectItem>
                  <SelectItem value="PUBLIC">Public (Everyone)</SelectItem>
                  <SelectItem value="TEAM">Team (Shared with members)</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {collection ? "Save Changes" : "Create Collection"}
        </Button>
      </div>
    </Form>
  );
}
