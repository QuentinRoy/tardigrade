import { type Kysely, sql } from "kysely";

// Renames `submission` to `grade_target` (the #136 core) and, in the same
// migration, rekeys its identity: the generated numeric `id` becomes the
// internal `row_id`, and a new public `id` (text, `t-<n>`, sequential within
// a project) takes its place. Combining the rekey with the rename avoids an
// intermediate state where the table is called `grade_target` but still
// exposes a bare numeric public id — the same atomic-transition rationale as
// `20260518000001_rekey_question_and_rubric.ts`.
//
// Column scope: the three target-identity FK columns move to the `_row_id`
// convention (`student_id` -> `student_row_id`, `group_id` -> `group_row_id`
// on `grade_target`; `submission_id` -> `grade_target_row_id` on
// `assessment`). `grade_target.project_id` is deliberately left as-is — the
// project/grid axis renames across every table together in a later stage, not
// here (tracked by #136; this migration does not close it).
//
// Kind axis: enum `submission_type` -> `grade_target_kind` (kept distinct
// from bare `kind`, which `criterion_kind` already owns), column `type` ->
// `kind`. Values (`individual`/`group`) are unchanged.
//
// The public `id`: generated, never derived from student id / group name /
// display label, and deliberately not opaque — a grade target's project is
// the access-control boundary, so within-project enumeration leaks nothing
// beyond what's already visible with project access (contrast `project.id`,
// opaque because it is top-level with no parent scope). Format is `t-<n>`
// where `<n>` is a per-project creation-order integer: text (not a bare
// integer) so it stays unmistakably an id, never confusable with the
// internal integer `row_id`. Backfilled here via `ROW_NUMBER() OVER
// (PARTITION BY project_id ORDER BY row_id)`; going forward, the app computes
// `COALESCE(MAX(substring(id FROM 3)::int), 0) + 1` per project inside the
// creating transaction (see `src/grade-targets/`), backstopped by the
// `grade_target_project_id_id_key` unique constraint against races. Reuse of
// a number after its target is deleted is accepted (no deletion path exists
// today, #45).
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below is passed to Postgres verbatim and matches the live
// schema exactly (see docs/reference/database-migrations.md). Constraint and
// index names are snake_case since `20260709000001_snake_case_constraint_and_index_names.ts`,
// so plain `renameConstraint` calls are used throughout.
//
// Renaming a UNIQUE/PRIMARY KEY constraint also renames its backing index, so
// the raw-SQL index renames below cover only plain (non-constraint) indexes:
// `submission_project_id_idx` (created per-table by `add_projects`) and the
// two plain unique indexes created via `createIndex` in the init migration
// (`submission_studentId_key`/`submission_teamId_key`, snake-cased to
// `submission_student_id_key`/`submission_group_id_key`). Table renames never
// auto-rename these — the same `question_pkey`/`question_project_id_idx` and
// `team_pkey`/`team_project_id_idx` landmine from the two preceding stages —
// so `submission_pkey` and `submission_project_id_idx` need an explicit
// rename alongside the table.
//
// No trigger or enforcement-function changes: neither `submission` nor
// `assessment` carries a trigger (all enforcement functions are
// criterion-scoped).
//
// `submission_type_participant_check` (renamed here, body untouched) is left
// unrewritten: Postgres tracks a CHECK constraint's compiled expression by
// column attribute number and enum OID, not by name, so the `type` -> `kind`
// column rename, the `student_id`/`group_id` -> `student_row_id`/
// `group_row_id` column renames, and the `submission_type` ->
// `grade_target_kind` enum rename all update its displayed body
// automatically.

const CONSTRAINT_RENAMES: ReadonlyArray<readonly [string, string, string]> = [
	// [table (post table-rename), from, to]
	["grade_target", "submission_pkey", "grade_target_pkey"],
	[
		"grade_target",
		"submission_project_id_fkey",
		"grade_target_project_id_fkey",
	],
	[
		"grade_target",
		"submission_student_id_fkey",
		"grade_target_student_row_id_fkey",
	],
	[
		"grade_target",
		"submission_group_id_fkey",
		"grade_target_group_row_id_fkey",
	],
	[
		"grade_target",
		"submission_type_participant_check",
		"grade_target_kind_participant_check",
	],
	[
		"assessment",
		"assessment_submission_id_fkey",
		"assessment_grade_target_row_id_fkey",
	],
	[
		"assessment",
		"assessment_submission_id_rubric_id_key",
		"assessment_grade_target_row_id_rubric_id_key",
	],
];

const INDEX_RENAMES: ReadonlyArray<readonly [string, string]> = [
	// [from, to] — plain indexes only; constraint-backed indexes follow their
	// constraint automatically.
	["submission_project_id_idx", "grade_target_project_id_idx"],
	["submission_student_id_key", "grade_target_student_row_id_key"],
	["submission_group_id_key", "grade_target_group_row_id_key"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("submission").renameTo("grade_target").execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("id", "row_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("student_id", "student_row_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("group_id", "group_row_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("type", "kind")
		.execute();
	await db.schema
		.alterTable("assessment")
		.renameColumn("submission_id", "grade_target_row_id")
		.execute();

	await db.schema
		.alterType("submission_type")
		.renameTo("grade_target_kind")
		.execute();

	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(from, to).execute();
	}
	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(from)} RENAME TO ${sql.id(to)}`.execute(db);
	}

	// Add the public id, nullable at first (there is no identity/default that
	// can produce `t-<n>` text), backfill per-project creation-order numbers,
	// then close the write boundary.
	await db.schema.alterTable("grade_target").addColumn("id", "text").execute();

	await sql`
    UPDATE "grade_target" gt
    SET "id" = 't-' || sub.rn
    FROM (
      SELECT "row_id", ROW_NUMBER() OVER (PARTITION BY "project_id" ORDER BY "row_id") AS rn
      FROM "grade_target"
    ) sub
    WHERE sub."row_id" = gt."row_id"
  `.execute(db);

	await db.schema
		.alterTable("grade_target")
		.alterColumn("id", (column) => column.setNotNull())
		.execute();
	await db.schema
		.alterTable("grade_target")
		.addUniqueConstraint("grade_target_project_id_id_key", ["project_id", "id"])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("grade_target")
		.dropConstraint("grade_target_project_id_id_key")
		.execute();
	await db.schema.alterTable("grade_target").dropColumn("id").execute();

	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(to)} RENAME TO ${sql.id(from)}`.execute(db);
	}
	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(to, from).execute();
	}

	await db.schema
		.alterType("grade_target_kind")
		.renameTo("submission_type")
		.execute();

	await db.schema
		.alterTable("assessment")
		.renameColumn("grade_target_row_id", "submission_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("kind", "type")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("group_row_id", "group_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("student_row_id", "student_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.renameColumn("row_id", "id")
		.execute();
	await db.schema.alterTable("grade_target").renameTo("submission").execute();
}
