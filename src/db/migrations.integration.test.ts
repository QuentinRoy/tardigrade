import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Kysely, sql } from "kysely";
import type { Migrator } from "kysely/migration";
import { describe, expect, it, test } from "vitest";
import type { Database } from "#db/generated/database.ts";
import {
	createMigrator,
	createTestDb,
	type DisposableTestDatabase,
	testMigrationsPath,
} from "#test/dbIntegration.ts";

const MIGRATIONS_DIR = "src/db/migrations/";
const UNIFY_MIGRATION = "20260721000000_unify_grade_target_students";

// Prefers origin/main because that's what a CI checkout actually has: it
// fetches remote branches as origin/* refs, not a local `main` branch (see
// .github/workflows/ci.yml). Falls back to a local `main` for local dev
// clones that track it directly.
function resolveBaseRef(): string {
	for (const ref of ["origin/main", "main"]) {
		try {
			execSync(`git rev-parse --verify ${ref}`, {
				stdio: "pipe",
				cwd: process.cwd(),
			});
			return ref;
		} catch {}
	}

	throw new Error(
		"Could not resolve 'origin/main' or 'main' to check migration immutability against. " +
			"This usually means the checkout is shallow and did not fetch main " +
			"(CI must use fetch-depth: 0, see .github/workflows/ci.yml). " +
			"Fix the checkout instead of skipping this check.",
	);
}

describe("Kysely migrations", () => {
	it("should not modify existing migrations compared to main", () => {
		const baseRef = resolveBaseRef();

		const baseMigrations = execSync(
			`git ls-tree -r --name-only ${baseRef} -- ${MIGRATIONS_DIR}`,
			{ encoding: "utf-8", cwd: process.cwd() },
		)
			.trim()
			.split("\n")
			.filter((line) => line.endsWith(".ts") && !line.endsWith("README.md"));

		const currentMigrations = execSync(
			`git ls-files ${MIGRATIONS_DIR} --cached --others --exclude-standard`,
			{ encoding: "utf-8", cwd: process.cwd() },
		)
			.trim()
			.split("\n")
			.filter(
				(line) =>
					line.length > 0 &&
					line.endsWith(".ts") &&
					!line.endsWith("README.md"),
			);

		const errors: string[] = [];

		for (const migration of baseMigrations) {
			if (!currentMigrations.includes(migration)) {
				errors.push(
					`Migration file ${migration} was deleted or renamed. Existing migrations are immutable and must not be deleted or renamed.`,
				);
				continue;
			}

			const baseContent = execSync(`git show ${baseRef}:${migration}`, {
				encoding: "utf-8",
				cwd: process.cwd(),
			});
			const currentContent = readFileSync(
				join(process.cwd(), migration),
				"utf-8",
			);

			const baseHash = createHash("sha256").update(baseContent).digest("hex");
			const currentHash = createHash("sha256")
				.update(currentContent)
				.digest("hex");

			if (baseHash !== currentHash) {
				errors.push(
					`Migration file ${migration} was modified. Existing migrations are immutable. Create a new migration instead of modifying existing ones.`,
				);
			}
		}

		// Migration order is append-only. A new migration must never sort before
		// an already-merged one: migrations run in filename order, so a
		// backdated/earlier-sorting file would be left unexecuted on any
		// environment that already ran the later migrations, silently skipping
		// it. Filenames are fixed-width timestamp-prefixed, so lexicographic
		// order is chronological order.
		let latestBaseMigration = "";
		for (const migration of baseMigrations) {
			if (migration > latestBaseMigration) {
				latestBaseMigration = migration;
			}
		}

		for (const migration of currentMigrations) {
			const isNewMigration = !baseMigrations.includes(migration);
			if (isNewMigration && migration < latestBaseMigration) {
				errors.push(
					`Migration file ${migration} sorts before the latest existing migration ${latestBaseMigration}. New migrations must be appended after all existing ones; do not insert a migration earlier in the sequence with a backdated filename.`,
				);
			}
		}

		if (errors.length > 0) {
			const message = `Immutable migration violations:\n${errors.map((error) => `  • ${error}`).join("\n")}`;
			expect.fail(message);
		}
	});
});

// Behavior of the unify-grade-targets migration (#292, ADR 0014). Each test
// clones the fully-migrated template, reverts the unify migration to reach the
// pre-#292 schema, seeds it through the plugin-less handle (migrations run
// without CamelCasePlugin, so identifiers stay snake_case), then drives the
// migration back up (and down) via the Migrator and asserts on the result.

async function previousMigrationName(migrator: Migrator): Promise<string> {
	const names = (await migrator.getMigrations()).map(
		(migration) => migration.name,
	);
	const index = names.indexOf(UNIFY_MIGRATION);
	const previous = names[index - 1];
	if (index < 0 || previous == null) {
		throw new Error(
			`Could not locate the migration before ${UNIFY_MIGRATION}.`,
		);
	}
	return previous;
}

async function migrateTo(migrator: Migrator, name: string): Promise<void> {
	const { error } = await migrator.migrateTo(name);
	if (error != null) {
		throw error;
	}
}

// Seeds the pre-#292 schema: a grid with a solo individual target and a named
// two-member group target.
async function seedPreUnify(db: Kysely<Database>): Promise<void> {
	await sql`INSERT INTO grid (id, name) VALUES ('mig-grid', 'Migration Grid')`.execute(
		db,
	);
	await sql`
		INSERT INTO student (id, last_name, first_name, grid_row_id)
		SELECT v.id, v.last_name, v.first_name, g.row_id
		FROM grid g
		CROSS JOIN (VALUES
			('s1', 'Solo', 'Alice'),
			('s2', 'Duo', 'Bob'),
			('s3', 'Duo', 'Carol')
		) AS v(id, last_name, first_name)
		WHERE g.id = 'mig-grid'
	`.execute(db);
	await sql`
		INSERT INTO "group" (name, grid_row_id)
		SELECT 'Team', row_id FROM grid WHERE id = 'mig-grid'
	`.execute(db);
	await sql`
		INSERT INTO student_to_group (student_id, group_id)
		SELECT s.row_id, gr.id
		FROM student s
		CROSS JOIN "group" gr
		WHERE s.id IN ('s2', 's3') AND gr.name = 'Team'
	`.execute(db);
	await sql`
		INSERT INTO grade_target (id, kind, student_row_id, grid_row_id)
		SELECT 't-1', 'individual', s.row_id, g.row_id
		FROM student s CROSS JOIN grid g
		WHERE s.id = 's1' AND g.id = 'mig-grid'
	`.execute(db);
	await sql`
		INSERT INTO grade_target (id, kind, group_row_id, grid_row_id)
		SELECT 't-2', 'group', gr.id, g.row_id
		FROM "group" gr CROSS JOIN grid g
		WHERE gr.name = 'Team' AND g.id = 'mig-grid'
	`.execute(db);
}

// Clones the fully-migrated template, reverts the unify migration to reach the
// pre-#292 schema, and returns the disposable db plus a plugin-less handle and
// a Migrator to drive the migration back through.
async function setupPreUnify(): Promise<{
	db: DisposableTestDatabase;
	migrationDb: Kysely<Database>;
	migrator: Migrator;
}> {
	const db = await createTestDb();
	const migrationDb = db.withoutPlugins();
	const migrator = createMigrator(migrationDb, testMigrationsPath);
	await migrateTo(migrator, await previousMigrationName(migrator));
	return { db, migrationDb, migrator };
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

describe("unify grade targets migration", () => {
	test("backfills membership and name, and round-trips through down", async () => {
		const { db, migrationDb, migrator } = await setupPreUnify();
		await using _db = db;

		await seedPreUnify(migrationDb);
		await migrateTo(migrator, UNIFY_MIGRATION);

		const targets = await sql<{ id: string; name: string | null }>`
			SELECT id, name FROM grade_target ORDER BY id
		`.execute(migrationDb);
		expect(targets.rows).toEqual([
			{ id: "t-1", name: null },
			{ id: "t-2", name: "Team" },
		]);

		const members = await sql<{ target: string; student: string }>`
			SELECT gt.id AS target, s.id AS student
			FROM grade_target_student gts
			JOIN grade_target gt ON gt.row_id = gts.grade_target_row_id
			JOIN student s ON s.row_id = gts.student_row_id
			ORDER BY gt.id, s.id
		`.execute(migrationDb);
		expect(members.rows).toEqual([
			{ target: "t-1", student: "s1" },
			{ target: "t-2", student: "s2" },
			{ target: "t-2", student: "s3" },
		]);

		// down() reconstructs the original individual/group shape.
		await migrateTo(migrator, await previousMigrationName(migrator));

		const restored = await sql<{
			id: string;
			kind: string;
			student: string | null;
			group_name: string | null;
		}>`
			SELECT gt.id, gt.kind, s.id AS student, grp.name AS group_name
			FROM grade_target gt
			LEFT JOIN student s ON s.row_id = gt.student_row_id
			LEFT JOIN "group" grp ON grp.id = gt.group_row_id
			ORDER BY gt.id
		`.execute(migrationDb);
		expect(restored.rows).toEqual([
			{ id: "t-1", kind: "individual", student: "s1", group_name: null },
			{ id: "t-2", kind: "group", student: null, group_name: "Team" },
		]);

		const restoredMembers = await sql<{ student: string }>`
			SELECT s.id AS student
			FROM student_to_group stg
			JOIN student s ON s.row_id = stg.student_id
			ORDER BY s.id
		`.execute(migrationDb);
		expect(restoredMembers.rows).toEqual([
			{ student: "s2" },
			{ student: "s3" },
		]);
	});

	test("aborts up() when a student is attached to two grade targets", async () => {
		const { db, migrationDb, migrator } = await setupPreUnify();
		await using _db = db;

		await seedPreUnify(migrationDb);
		// Make s1 (already an individual target owner) also a member of the group,
		// a partition violation.
		await sql`
			INSERT INTO student_to_group (student_id, group_id)
			SELECT s.row_id, gr.id
			FROM student s CROSS JOIN "group" gr
			WHERE s.id = 's1' AND gr.name = 'Team'
		`.execute(migrationDb);

		const { error } = await migrator.migrateTo(UNIFY_MIGRATION);
		expect(errorMessage(error)).toContain(
			"attached to more than one grade target",
		);
	});

	test("aborts up() when a group grade target has no members", async () => {
		const { db, migrationDb, migrator } = await setupPreUnify();
		await using _db = db;

		await seedPreUnify(migrationDb);
		// A second group target with no student_to_group members.
		await sql`
			INSERT INTO "group" (name, grid_row_id)
			SELECT 'Empty', row_id FROM grid WHERE id = 'mig-grid'
		`.execute(migrationDb);
		await sql`
			INSERT INTO grade_target (id, kind, group_row_id, grid_row_id)
			SELECT 't-3', 'group', gr.id, g.row_id
			FROM "group" gr CROSS JOIN grid g
			WHERE gr.name = 'Empty' AND g.id = 'mig-grid'
		`.execute(migrationDb);

		const { error } = await migrator.migrateTo(UNIFY_MIGRATION);
		expect(errorMessage(error)).toContain(
			"group grade target(s) have no members",
		);
	});
});
