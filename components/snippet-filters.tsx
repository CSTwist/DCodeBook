"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown } from "lucide-react";

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Updated (newest)" },
  { value: "updated_asc", label: "Updated (oldest)" },
  { value: "title_asc", label: "Title A–Z" },
  { value: "title_desc", label: "Title Z–A" },
] as const;

interface Props {
  sort: string;
  language?: string;
  languages: string[];
}

export function SnippetFilters({
  sort,
  language,
  languages,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function buildUrl(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(updates)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    // Reset pagination when filters change.
    params.delete("page");
    params.delete("loadMore");
    const qs = params.toString();
    return `/snippets${qs ? `?${qs}` : ""}`;
  }

  function handleSortChange(value: string | null) {
    if (!value) return;
    router.replace(buildUrl({ sort: value }));
  }

  function handleLanguageClick(lang: string) {
    const next = language === lang ? undefined : lang;
    router.replace(buildUrl({ language: next }));
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Language:</span>
        {languages.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          languages.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => handleLanguageClick(lang)}
              aria-pressed={language === lang}
            >
              <Badge variant={language === lang ? "default" : "secondary"}>
                {lang}
              </Badge>
            </button>
          ))
        )}
        {language && (
          <button
            type="button"
            onClick={() => handleLanguageClick(language)}
            aria-label="Clear language filter"
          >
            <Badge variant="outline">Clear</Badge>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        <Select value={sort} onValueChange={handleSortChange}>
          <SelectTrigger size="sm" aria-label="Sort snippets">
            <SelectValue>
              {(value) =>
                SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Sort"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
