"use client";

import { useState, type KeyboardEvent, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  existingTags?: { id: string; name: string }[];
}

export function TagInput({ value, onChange, existingTags = [] }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);

  const tags = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  function commitTags(nextTags: string[]) {
    onChange(nextTags.join(", "));
  }

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name) return;
    const exists = tags.some((t) => t.toLowerCase() === name.toLowerCase());
    if (exists) {
      setInputValue("");
      return;
    }
    commitTags([...tags, name]);
    setInputValue("");
  }

  function removeTag(name: string) {
    commitTags(tags.filter((t) => t !== name));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    if (!open) setOpen(true);
  }

  const query = inputValue.trim().toLowerCase();
  const suggestions = existingTags
    .filter((t) => (query ? t.name.toLowerCase().includes(query) : true))
    .filter(
      (t) => !tags.some((existing) => existing.toLowerCase() === t.name.toLowerCase()),
    )
    .slice(0, 8);

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<div className="w-full" />}>
          <Input
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder="Add tags... (press Enter or comma)"
          />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1">
          {suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No suggestions
            </p>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  addTag(s.name);
                  setOpen(false);
                }}
                className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {s.name}
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
