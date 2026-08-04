import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSafeCallbackUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "/dashboard";
  const trimmed = url.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\")
  ) {
    return "/dashboard";
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") return "/dashboard";
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return "/dashboard";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}
