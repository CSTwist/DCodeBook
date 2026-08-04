/**
 * Helper to resolve the canonical site URL with scheme and host (no trailing slash).
 * Resolution order:
 * 1. NEXT_PUBLIC_APP_URL
 * 2. VERCEL_PROJECT_PRODUCTION_URL (prefixed with https:// if scheme is missing)
 * 3. VERCEL_URL (prefixed with https:// if scheme is missing)
 * 4. Fallback to http://localhost:3000 (development only)
 */
export function getSiteUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;

  const isProduction = process.env.NODE_ENV === "production";

  if (!rawUrl || !rawUrl.trim()) {
    if (isProduction) {
      throw new Error(
        "Invalid site URL configuration: No site URL environment variable set (NEXT_PUBLIC_APP_URL, VERCEL_PROJECT_PRODUCTION_URL, or VERCEL_URL)."
      );
    }
    return "http://localhost:3000";
  }

  const trimmedUrl = rawUrl.trim();

  // Reject explicit non-http(s) schemes (e.g. ftp://, file://, javascript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmedUrl) && !/^https?:\/\//i.test(trimmedUrl)) {
    if (isProduction) {
      throw new Error(
        `Invalid site URL configuration: "${rawUrl}" is not a valid HTTP or HTTPS URL.`
      );
    }
    console.warn(`[site-url] Non-http(s) URL "${rawUrl}", falling back to http://localhost:3000`);
    return "http://localhost:3000";
  }

  let urlString = trimmedUrl;
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      if (isProduction) {
        throw new Error(
          `Invalid site URL configuration: "${rawUrl}" is not a valid HTTP or HTTPS URL.`
        );
      }
      console.warn(`[site-url] Non-http(s) URL "${rawUrl}", falling back to http://localhost:3000`);
      return "http://localhost:3000";
    }
    return parsed.origin;
  } catch (error) {
    if (isProduction) {
      throw new Error(
        `Invalid site URL configuration: "${rawUrl}" could not be parsed as a valid URL.`
      );
    }
    console.warn(`[site-url] Malformed URL "${rawUrl}", falling back to http://localhost:3000:`, error);
    return "http://localhost:3000";
  }
}

