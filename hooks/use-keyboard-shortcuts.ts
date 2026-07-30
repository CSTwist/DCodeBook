"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function focusSearch() {
  const byId = document.getElementById("search-input") as HTMLInputElement | null;
  if (byId) {
    byId.focus();
    return;
  }
  const byPlaceholder = document.querySelector<HTMLInputElement>(
    'input[placeholder*="Search" i]'
  );
  byPlaceholder?.focus();
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const helpOpenRef = useRef(helpOpen);
  helpOpenRef.current = helpOpen;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      if (helpOpenRef.current) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "/") {
        e.preventDefault();
        focusSearch();
      } else if (e.key === "n") {
        e.preventDefault();
        router.push("/snippets/new");
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [router]);

  return { helpOpen, setHelpOpen };
}
