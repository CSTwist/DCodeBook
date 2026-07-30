import { z } from "zod";

export const snippetSchema = z.object({
  title: z.string().min(1, "Title required").max(200),
  description: z.string().max(2000).optional(),
  code: z.string().min(1, "Code required").max(50000),
  language: z.string().min(1).max(50),
  tagNames: z.array(z.string().min(1).max(40)).max(20).optional(),
  collectionId: z.string().cuid().optional().nullable(),
});

export const collectionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PRIVATE", "PUBLIC", "TEAM"]),
});

export const memberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(["VIEWER", "EDITOR", "ADMIN"]),
});

export type SnippetInput = z.infer<typeof snippetSchema>;
export type CollectionInput = z.infer<typeof collectionSchema>;
