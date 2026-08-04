"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
} from "@/components/ui/input-group";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const [isPending, startTransition] = useTransition();

  // Sync local state with URL query parameter on back/forward navigation or external URL change
  useEffect(() => {
    setValue(urlQ);
  }, [urlQ]);

  // Keep a ref to the latest searchParams so the debounce effect only
  // re-runs when the input value actually changes (avoids navigation loops).
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    // If local value matches URL q parameter, skip redundant replacement
    if (value === (searchParamsRef.current.get("q") ?? "")) {
      return;
    }
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      // Reset pagination when the query changes.
      params.delete("page");
      startTransition(() => {
        const queryStr = params.toString();
        router.replace(queryStr ? `/snippets?${queryStr}` : "/snippets");
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [value, router]);

  return (
    <InputGroup>
      <InputGroupAddon>
        <Search className="h-4 w-4" />
      </InputGroupAddon>
      <InputGroupInput
        id="search-input"
        aria-label="Search snippets"
        placeholder="Search snippets, code, tags…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {isPending ? (
        <InputGroupAddon>
          <Loader2 className="h-4 w-4 animate-spin" />
        </InputGroupAddon>
      ) : value ? (
        <InputGroupButton
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
        >
          <X className="h-4 w-4" />
        </InputGroupButton>
      ) : null}
    </InputGroup>
  );
}
