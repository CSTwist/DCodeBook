"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormSetError, type FieldValues, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createSnippet, updateSnippet } from "@/actions/snippets";
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
import { CodeEditor } from "@/components/code-editor";
import { TagInput } from "@/components/tag-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).optional(),
  code: z.string().min(1, "Code required").max(50000),
  language: z.string().min(1, "Language required").max(50),
  tags: z.string().optional(),
  collectionId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const LANGUAGES = [
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
  { value: "shell", label: "Shell" },
];

interface SnippetTagRelation {
  tag: { name: string };
}

interface SnippetProp {
  id: string;
  title: string;
  description?: string | null;
  code: string;
  language: string;
  collectionId?: string | null;
  tags?: SnippetTagRelation[];
}

interface SnippetFormProps {
  snippet?: SnippetProp;
  collections?: { id: string; name: string }[];
  allTags?: { id: string; name: string }[];
  defaultCollectionId?: string;
}

function handleActionError<T extends FieldValues>(
  resError: unknown,
  setError: UseFormSetError<T>,
  fieldMap?: Record<string, FieldPath<T>>,
  fallbackMessage = "An error occurred"
) {
  if (typeof resError === "object" && resError !== null) {
    const fieldErrors = resError as Record<string, string[]>;
    let hasSetFieldError = false;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && messages.length > 0) {
        const targetField = (fieldMap?.[field] ?? field) as FieldPath<T>;
        setError(targetField, {
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
      toast.error("Snippet not found");
    } else if (resError === "FORBIDDEN") {
      toast.error("You do not have permission to perform this action");
    } else {
      toast.error(resError);
    }
  } else {
    toast.error(fallbackMessage);
  }
}

export function SnippetForm({
  snippet,
  collections = [],
  allTags = [],
  defaultCollectionId,
}: SnippetFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultTags = snippet?.tags?.map((t) => t.tag.name).join(", ") ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: snippet?.title ?? "",
      description: snippet?.description ?? "",
      code: snippet?.code ?? "",
      language: snippet?.language ?? "typescript",
      tags: defaultTags,
      collectionId: snippet?.collectionId ?? defaultCollectionId ?? "none",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("title", values.title);
      if (values.description) {
        formData.append("description", values.description);
      }
      formData.append("code", values.code);
      formData.append("language", values.language);
      if (values.collectionId && values.collectionId !== "none") {
        formData.append("collectionId", values.collectionId);
      }

      if (values.tags) {
        const tagList = values.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        tagList.forEach((tag) => formData.append("tagNames", tag));
      }

      try {
        if (snippet) {
          const res = await updateSnippet(snippet.id, formData);
          if (res?.error) {
            handleActionError(
              res.error,
              form.setError,
              { tagNames: "tags" },
              "Failed to update snippet"
            );
          } else {
            toast.success("Snippet updated successfully");
            router.push(`/snippets/${snippet.id}`);
            router.refresh();
          }
        } else {
          const res = (await createSnippet(formData)) as Record<string, unknown> | undefined;
          if (res && "error" in res) {
            handleActionError(
              res.error,
              form.setError,
              { tagNames: "tags" },
              "Failed to create snippet"
            );
          } else if (res && "snippetId" in res) {
            toast.success("Snippet created successfully");
            router.push(`/snippets/${res.snippetId as string}`);
            router.refresh();
          }
        }
      } catch {
        toast.error("An unexpected error occurred. Please try again.");
      }
    });
  }

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="Snippet title..." {...field} />
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

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Language</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {collections.length > 0 && (
          <FormField
            control={form.control}
            name="collectionId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collection</FormLabel>
                <FormControl>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None (Standalone)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Standalone)</SelectItem>
                      {collections.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tags</FormLabel>
            <FormControl>
              <TagInput
                value={field.value ?? ""}
                onChange={field.onChange}
                existingTags={allTags}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Code</FormLabel>
            <FormControl>
              <CodeEditor
                value={field.value as string}
                onChange={field.onChange}
                placeholder="// Write your code here..."
                className="font-mono min-h-[240px]"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex gap-4 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {snippet ? "Save Changes" : "Create Snippet"}
        </Button>
      </div>
    </Form>
  );
}

