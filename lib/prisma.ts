import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // Use pooled DATABASE_URL for runtime (serverless-safe via pg Pool).
  // Falls back to DATABASE_URL_DIRECT if no pooled URL is set.
  const connectionString =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;

  if (!connectionString) {
    throw new Error(
      "Missing DATABASE_URL or DATABASE_URL_DIRECT environment variable.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
