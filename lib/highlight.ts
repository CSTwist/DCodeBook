import { codeToHtml } from "shiki";

export async function highlight(code: string, lang: string, dark = false) {
  const theme = dark ? "github-dark" : "github-light";
  try {
    return await codeToHtml(code, { lang: lang || "text", theme });
  } catch {
    return await codeToHtml(code, { lang: "text", theme });
  }
}

