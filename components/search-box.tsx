"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (
    <Input
      placeholder="Search snippets, code, tags…"
      defaultValue={searchParams.get("q") ?? ""}
      onChange={(e) =>
        router.replace(`/snippets?q=${encodeURIComponent(e.target.value)}`)
      }
    />
  );
}
