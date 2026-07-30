import { codeToHtml } from "shiki";

export async function highlight(code: string, lang: string, dark = false) {
  return codeToHtml(code, { lang: lang || "text", theme: dark ? "github-dark" : "github-light" });
}
