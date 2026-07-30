// prisma/seed.ts — idempotent demo data for local development.
// Run via: pnpm prisma db seed (requires DATABASE_URL with a running Postgres).
//
// Creates:
//   1 demo user
//   5 tags (typescript, react, nextjs, prisma, utility)
//   3 collections (one PUBLIC, one PRIVATE, one TEAM)
//   5 snippets spread across collections, tagged

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;

if (!connectionString) {
  throw new Error(
    "Missing DATABASE_URL or DATABASE_URL_DIRECT environment variable.",
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Demo user ---
  const user = await prisma.user.upsert({
    where: { email: "dev@dcodebook.local" },
    update: {},
    create: {
      email: "dev@dcodebook.local",
      name: "Demo Developer",
      role: "USER",
    },
  });

  console.log(`Seeded user: ${user.email} (${user.id})`);

  // --- Tags ---
  const tagNames = ["typescript", "react", "nextjs", "prisma", "utility"];
  const tags: Record<string, string> = {};
  for (const name of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    tags[name] = tag.id;
    console.log(`Seeded tag: ${name}`);
  }

  // --- Collections ---
  const publicCol = await prisma.collection.create({
    data: {
      name: "Public Snippets",
      description: "A collection of snippets visible to everyone, even without logging in.",
      ownerId: user.id,
      visibility: "PUBLIC",
    },
  });
  console.log(`Seeded collection: ${publicCol.name} (PUBLIC)`);

  const privateCol = await prisma.collection.create({
    data: {
      name: "Private Notes",
      description: "Personal snippets only visible to me.",
      ownerId: user.id,
      visibility: "PRIVATE",
    },
  });
  console.log(`Seeded collection: ${privateCol.name} (PRIVATE)`);

  const teamCol = await prisma.collection.create({
    data: {
      name: "Team Playbook",
      description: "Shared snippets for team members.",
      ownerId: user.id,
      visibility: "TEAM",
    },
  });
  console.log(`Seeded collection: ${teamCol.name} (TEAM)`);

  // --- Snippets ---
  const snippetsData = [
    {
      title: "Prisma Client Singleton",
      description: "Avoid exhausting DB connections during Next.js hot-reload by reusing a global PrismaClient instance.",
      code: `import { PrismaClient } from "@prisma/client";\n\nconst globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };\n\nexport const prisma = globalForPrisma.prisma ?? new PrismaClient();\n\nif (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;`,
      language: "typescript",
      collectionId: publicCol.id,
      tagNames: ["prisma", "nextjs"],
    },
    {
      title: "React Server Component Data Fetch",
      description: "Fetch data directly in an async RSC — no useEffect, no client-side state.",
      code: `import { prisma } from "@/lib/prisma";\n\nexport default async function SnippetsPage() {\n  const snippets = await prisma.snippet.findMany({\n    where: { collection: { visibility: "PUBLIC" } },\n    orderBy: { updatedAt: "desc" },\n    take: 20,\n  });\n\n  return (\n    <ul>\n      {snippets.map((s) => (\n        <li key={s.id}>{s.title}</li>\n      ))}\n    </ul>\n  );\n}`,
      language: "typescript",
      collectionId: publicCol.id,
      tagNames: ["react", "nextjs"],
    },
    {
      title: "cn() Utility with clsx + tailwind-merge",
      description: "Shadcn UI standard class merge helper — resolves Tailwind conflicts and supports conditional classes.",
      code: `import { clsx, type ClassValue } from "clsx";\nimport { twMerge } from "tailwind-merge";\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs));\n}`,
      language: "typescript",
      collectionId: publicCol.id,
      tagNames: ["utility", "react"],
    },
    {
      title: "Draft: Personal project ideas",
      description: "Scratch notes about things I want to build later.",
      code: `// Ideas for weekend projects:\n// - CLI tool to scaffold Prisma schemas from markdown\n// - Personal dashboard with cron job monitoring\n// - WebGL shader playground`,
      language: "plaintext",
      collectionId: privateCol.id,
      tagNames: [],
    },
    {
      title: "Team ESLint Config Base",
      description: "Shared ESLint configuration for team projects — extends next/core-web-vitals + TypeScript strict.",
      code: `import { FlatCompat } from "@eslint/eslintrc";\n\nconst compat = new FlatCompat({ baseDirectory: import.meta.dirname });\n\nexport default [\n  ...compat.extends("next/core-web-vitals", "next/typescript"),\n  {\n    rules: {\n      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],\n      "no-console": "warn",\n    },\n  },\n];`,
      language: "typescript",
      collectionId: teamCol.id,
      tagNames: ["typescript", "utility"],
    },
  ];

  for (const s of snippetsData) {
    const snippet = await prisma.snippet.create({
      data: {
        title: s.title,
        description: s.description,
        code: s.code,
        language: s.language,
        ownerId: user.id,
        collectionId: s.collectionId,
        tags: {
          create: s.tagNames.map((name) => ({
            tag: { connect: { name } },
          })),
        },
      },
    });
    console.log(`Seeded snippet: ${snippet.title}`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
