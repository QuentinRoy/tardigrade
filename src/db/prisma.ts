import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import cursorStream from "prisma-cursorstream";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString == null || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter }).$extends(cursorStream);
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: AppPrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
