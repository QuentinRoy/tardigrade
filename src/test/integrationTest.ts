import type { Kysely } from "kysely";
import type { TestAPI } from "vitest";
import { test as base, expect } from "vitest";
import type { DB } from "../db/types";
import {
  resolvePathFromMeta,
  startTestDatabase,
  stopTestDatabase,
} from "./dbIntegration";
import { cleanupProjects, createProject } from "./projects";

type IntegrationFixtures = {
  db: Kysely<DB>;
  createProject: (name: string) => Promise<number>;
};

type IntegrationTestApi = TestAPI<IntegrationFixtures>;

export function createIntegrationTest(importMetaUrl: string): {
  test: IntegrationTestApi;
  expect: typeof expect;
} {
  const test = base.extend<IntegrationFixtures>({
    db: [
      async ({}, use) => {
        const startedDb = await startTestDatabase(
          resolvePathFromMeta(importMetaUrl, "../db/migrations"),
        );

        try {
          await use(startedDb.db);
        } finally {
          await stopTestDatabase(startedDb);
        }
      },
      { scope: "file" },
    ],
    createProject: async ({ db }, use) => {
      const createdProjectIds: number[] = [];
      const create = (name: string) =>
        createProject(db, name, createdProjectIds);

      try {
        await use(create);
      } finally {
        await cleanupProjects(db, createdProjectIds);
      }
    },
  });

  return { test: test as IntegrationTestApi, expect };
}
