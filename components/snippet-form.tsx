"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
}

export function SnippetForm({ snippet, collections = [] }: SnippetFormProps) {
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
      collectionId: snippet?.collectionId ?? "",
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
      if (values.collectionId) {
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
            toast.error(typeof res.error === "string" ? res.error : "Failed to update snippet");
          } else {
            toast.success("Snippet updated successfully");
            router.push(`/snippets/${snippet.id}`);
            router.refresh();
          }
        } else {
          const res = await createSnippet(formData) as Record<string, unknown> | undefined;
          if (res && "error" in res) {
            toast.error(typeof res.error === "string" ? (res.error as string) : "Failed to create snippet");
          } else if (res && "snippetId" in res) {
            toast.success("Snippet created successfully");
            router.push(`/snippets/${res.snippetId as string}`);
            router.refresh();
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "An error occurred");
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
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="None (Standalone)" />
                    </SelectTrigger>
                    <SelectContent>
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
              <Input placeholder="react, typescript, ui (comma separated)" {...field} />
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
              <Textarea
                placeholder="// Write your code here..."
                className="font-mono min-h-[240px]"
                {...field}
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
