import { type Kysely, sql } from "kysely";

// Renames `project` to `grid` (the outermost identifier — CONTEXT: Grid) and
// the `project_id` foreign-key columns on all five child tables to
// `grid_row_id`. The `_row_id` suffix is honest: the column holds the internal
// surrogate `grid.row_id`, not the public Grid ID, so `grid_id` would misread
// as the public id. Completes #136's last requirement (rename FK columns that
// target internal row ids).
//
// Also re-prefixes the public grid id from `p-` to `g-` (backfill below): a
// prefix swap that keeps the unique nanoid suffix, so the map is bijective and
// the `grid_id_key` unique index cannot be violated. No code parses the prefix
// (it is an opaque string everywhere), and the id is stored only in `grid.id`,
// so this one column is the whole backfill.
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below passes to Postgres verbatim and matches the live schema (see
// docs/reference/database-migrations.md). Constraint/index names have been
// snake_case since 20260709000001, so plain `renameConstraint` calls suffice.
//
// Renaming a UNIQUE/PRIMARY KEY constraint also renames its backing index, so
// the raw `ALTER INDEX` renames cover only the plain per-table
// `*_project_id_idx` indexes. The table's own `project_pkey` and the public-id
// `project_id_key` do NOT auto-rename with the table (the recurring
// `question_pkey`/`team_pkey`/`submission_pkey` landmine, found only by
// inspecting the live schema) — renamed explicitly here.
//
// Not touched, by established precedent: the identity sequence backing
// `project.row_id` is named `project_id_seq` and is left stale, exactly as
// `submission_id_seq` (stage 4), `team_id_seq` (stage 3), and the criterion-kind
// sequences (stage 2) were — the identity sequence name is internal and no prior
// rename renamed it. No triggers exist on `project` or the child FK tables.

const COLUMN_TABLES = [
	"criterion",
	"grade_target",
	"group",
	"rubric",
	"student",
] as const;

const CONSTRAINT_RENAMES: ReadonlyArray<readonly [string, string, string]> = [
	// [table (post table-rename), from, to]
	["grid", "project_pkey", "grid_pkey"],
	["grid", "project_id_key", "grid_id_key"],
	["criterion", "criterion_project_id_fkey", "criterion_grid_row_id_fkey"],
	["criterion", "criterion_project_id_id_key", "criterion_grid_row_id_id_key"],
	[
		"grade_target",
		"grade_target_project_id_fkey",
		"grade_target_grid_row_id_fkey",
	],
	[
		"grade_target",
		"grade_target_project_id_id_key",
		"grade_target_grid_row_id_id_key",
	],
	["group", "group_project_id_fkey", "group_grid_row_id_fkey"],
	["group", "group_name_project_id_key", "group_name_grid_row_id_key"],
	["rubric", "rubric_project_id_fkey", "rubric_grid_row_id_fkey"],
	["rubric", "rubric_project_id_id_key", "rubric_grid_row_id_id_key"],
	["student", "student_project_id_fkey", "student_grid_row_id_fkey"],
	["student", "student_project_id_id_key", "student_grid_row_id_id_key"],
];

const INDEX_RENAMES: ReadonlyArray<readonly [string, string]> = [
	// Plain indexes only; constraint-backed indexes follow their constraint.
	["criterion_project_id_idx", "criterion_grid_row_id_idx"],
	["grade_target_project_id_idx", "grade_target_grid_row_id_idx"],
	["group_project_id_idx", "group_grid_row_id_idx"],
	["rubric_project_id_idx", "rubric_grid_row_id_idx"],
	["student_project_id_idx", "student_grid_row_id_idx"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("project").renameTo("grid").execute();

	for (const table of COLUMN_TABLES) {
		await db.schema
			.alterTable(table)
			.renameColumn("project_id", "grid_row_id")
			.execute();
	}

	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(from, to).execute();
	}
	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(from)} RENAME TO ${sql.id(to)}`.execute(db);
	}

	await sql`UPDATE "grid" SET "id" = 'g-' || substring("id" FROM 3) WHERE "id" LIKE 'p-%'`.execute(
		db,
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`UPDATE "grid" SET "id" = 'p-' || substring("id" FROM 3) WHERE "id" LIKE 'g-%'`.execute(
		db,
	);

	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(to)} RENAME TO ${sql.id(from)}`.execute(db);
	}
	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(to, from).execute();
	}

	for (const table of COLUMN_TABLES) {
		await db.schema
			.alterTable(table)
			.renameColumn("grid_row_id", "project_id")
			.execute();
	}

	await db.schema.alterTable("grid").renameTo("project").execute();
}
