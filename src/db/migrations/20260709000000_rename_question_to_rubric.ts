import { type Kysely, sql } from "kysely";

// Terminology sweep stage 2b: the container gradeable shape is renamed
// Question -> Rubric. The leaf (Criterion) and the criterion-kind axis landed in
// stage 2a; the assess axis (`assessment`, `saveAssessment`, the `assessment-*`
// modules) is stage 5. Here only the container noun moves: table `question` ->
// `rubric`, and the container FK `question_id` -> `rubric_id` on `criterion` and
// `assessment`. The `assessment` table keeps its name (stage 5); only its FK
// column moves now, so `question`/`question_id` is fully vacated from the schema.
//
// The schema builder is used throughout: renameTo for the table, renameColumn
// for the columns, and renameConstraint for the constraints. The migration
// runners build Kysely without CamelCasePlugin, so every identifier below is
// passed to Postgres verbatim and the pre-2b names are the same on every
// database (see docs/reference/database-migrations.md). Constraint names keep
// their historical spelling style here (PascalCase where they were PascalCase);
// the snake_case normalization is a separate follow-up migration.
//
// Renaming a UNIQUE/PRIMARY KEY constraint also renames its backing index, so
// the only explicit index rename is the one plain (non-constraint) index,
// `question_project_id_idx`. Raw SQL for that single rename: the schema builder
// has no index-rename API.
//
// No enum or trigger changes are needed: 2a's enforcement functions/triggers
// are all criterion-scoped and neither `question` nor `assessment` carries a
// trigger.

const CONSTRAINT_RENAMES: ReadonlyArray<readonly [string, string, string]> = [
	// [table (post table-rename), from, to]
	["rubric", "question_pkey", "rubric_pkey"],
	["rubric", "Question_projectId_id_key", "Rubric_projectId_id_key"],
	["rubric", "Question_projectId_fkey", "Rubric_projectId_fkey"],
	["criterion", "Criterion_questionId_fkey", "Criterion_rubricId_fkey"],
	[
		"criterion",
		"Criterion_questionId_position_key",
		"Criterion_rubricId_position_key",
	],
	["assessment", "Assessment_questionId_fkey", "Assessment_rubricId_fkey"],
	[
		"assessment",
		"Assessment_submissionId_questionId_key",
		"Assessment_submissionId_rubricId_key",
	],
];

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("question").renameTo("rubric").execute();
	await db.schema
		.alterTable("criterion")
		.renameColumn("question_id", "rubric_id")
		.execute();
	await db.schema
		.alterTable("assessment")
		.renameColumn("question_id", "rubric_id")
		.execute();

	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(from, to).execute();
	}

	await sql`ALTER INDEX "question_project_id_idx" RENAME TO "rubric_project_id_idx"`.execute(
		db,
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`ALTER INDEX "rubric_project_id_idx" RENAME TO "question_project_id_idx"`.execute(
		db,
	);

	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(to, from).execute();
	}

	await db.schema
		.alterTable("assessment")
		.renameColumn("rubric_id", "question_id")
		.execute();
	await db.schema
		.alterTable("criterion")
		.renameColumn("rubric_id", "question_id")
		.execute();
	await db.schema.alterTable("rubric").renameTo("question").execute();
}
