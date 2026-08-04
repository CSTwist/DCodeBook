"use client";

import { useState, useId, type KeyboardEvent, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TagInputProps {
  id?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  value: string;
  onChange: (value: string) => void;
  existingTags?: { id: string; name: string }[];
}

export function TagInput({
  id: propId,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  value,
  onChange,
  existingTags = [],
}: TagInputProps) {
  const generatedId = useId();
  const inputId = propId ?? `${generatedId}-input`;
  const listboxId = `${generatedId}-listbox`;

  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

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

  const query = inputValue.trim().toLowerCase();
  const suggestions = existingTags
    .filter((t) => (query ? t.name.toLowerCase().includes(query) : true))
    .filter(
      (t) => !tags.some((existing) => existing.toLowerCase() === t.name.toLowerCase()),
    )
    .slice(0, 8);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
      } else if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open && suggestions.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        addTag(suggestions[activeIndex].name);
        setOpen(false);
        setActiveIndex(-1);
      } else if (inputValue.trim()) {
        addTag(inputValue);
        setOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
      setOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      e.preventDefault();
      removeTag(tags[tags.length - 1]);
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    setActiveIndex(-1);
    if (!open) setOpen(true);
  }

  const activeOptionId =
    activeIndex >= 0 && suggestions[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

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
        <PopoverTrigger
          render={(props) => (
            <Input
              {...props}
              id={inputId}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              placeholder="Add tags... (press Enter or comma)"
            />
          )}
        />
        <PopoverContent
          id={listboxId}
          role="listbox"
          aria-label="Tag suggestions"
          className="w-72 p-1"
        >
          {suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No suggestions
            </p>
          ) : (
            suggestions.map((s, index) => {
              const optionId = `${listboxId}-option-${index}`;
              const isActive = index === activeIndex;
              return (
                <button
                  key={s.id}
                  id={optionId}
                  role="option"
                  aria-selected={isActive}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    addTag(s.name);
                    setOpen(false);
                    setActiveIndex(-1);
                  }}
                  className={cn(
                    "block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                    isActive && "bg-accent text-accent-foreground"
                  )}
                >
                  {s.name}
                </button>
              );
            })
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

