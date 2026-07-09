import type { Kysely } from "kysely";

// TEMPORARY: a backdated (earlier-sorting) migration filename used only to
// prove the append-only ordering check in migrations.integration.test.ts
// actually fails CI on a real out-of-order migration. Reverted in the next
// commit. No-op so it doesn't affect any schema.
export async function up(_db: Kysely<unknown>): Promise<void> {}

export async function down(_db: Kysely<unknown>): Promise<void> {}
