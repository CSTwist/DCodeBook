import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use the DIRECT (unpooled) URL for migrations — Prisma's migration
    // engine opens long connections that a pooler can stall on.
    // The runtime app uses the pooled URL via the adapter in lib/prisma.ts.
    url: process.env["DATABASE_URL_DIRECT"] ?? process.env["DATABASE_URL"]!,
  },
});
