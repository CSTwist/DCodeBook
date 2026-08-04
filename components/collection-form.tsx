"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormSetError, type FieldValues, type Path } from "react-hook-form";
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

function handleActionError<T extends FieldValues>(
  resError: unknown,
  setError: UseFormSetError<T>,
  fallbackMessage = "An error occurred"
) {
  if (typeof resError === "object" && resError !== null) {
    const fieldErrors = resError as Record<string, string[]>;
    let hasSetFieldError = false;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        setError(field as Path<T>, {
          type: "server",
          message: messages.join(", "),
        });
        hasSetFieldError = true;
      }
    }
    if (!hasSetFieldError) {
      toast.error(fallbackMessage);
    }
  } else if (typeof resError === "string") {
    if (resError === "NOT_FOUND") {
      toast.error("Collection not found");
    } else if (resError === "FORBIDDEN") {
      toast.error("You do not have permission to perform this action");
    } else {
      toast.error(resError);
    }
  } else {
    toast.error(fallbackMessage);
  }
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
            handleActionError(res.error, form.setError, "Failed to update collection");
          } else {
            toast.success("Collection updated successfully");
            if (onSuccess) onSuccess();
            router.refresh();
          }
        } else {
          const res = (await createCollection(formData)) as Record<string, unknown> | undefined;
          if (res && "error" in res) {
            handleActionError(res.error, form.setError, "Failed to create collection");
          } else if (res && "collectionId" in res) {
            toast.success("Collection created successfully");
            if (onSuccess) onSuccess();
            router.refresh();
          }
        }
      } catch {
        toast.error("An unexpected error occurred. Please try again.");
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
            {field.value === "PUBLIC" && (
              <p className="text-xs text-amber-600 dark:text-amber-500 font-medium mt-1.5">
                Note: PUBLIC collections are readable by anonymous users and indexable by search engines.
              </p>
            )}
            {collection?.visibility === "PUBLIC" && field.value !== "PUBLIC" && (
              <p className="text-xs text-destructive font-medium mt-1.5">
                Warning: Leaving PUBLIC will invalidate public links to this collection and its snippets.
              </p>
            )}
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
