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
  const initialQ = searchParams.get("q") ?? "";
  const [value, setValue] = useState(initialQ);
  const [isPending, startTransition] = useTransition();
  const isFirst = useRef(true);

  // Keep a ref to the latest searchParams so the debounce effect only
  // re-runs when the input value actually changes (avoids navigation loops).
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
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
      params.delete("loadMore");
      startTransition(() => {
        router.replace(`/snippets?${params.toString()}`);
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
