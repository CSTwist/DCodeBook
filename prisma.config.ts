import "dotenv/config";
import { defineConfig } from "@prisma/config";

const dbUrl = process.env["DATABASE_URL_DIRECT"] || process.env["DATABASE_URL"];
if (!dbUrl) {
  throw new Error("Missing database connection URL. Please set DATABASE_URL_DIRECT or DATABASE_URL environment variable.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use the DIRECT (unpooled) URL for migrations — Prisma's migration
    // engine opens long connections that a pooler can stall on.
    // The runtime app uses the pooled URL via the adapter in lib/prisma.ts.
    url: dbUrl,
  },
});
