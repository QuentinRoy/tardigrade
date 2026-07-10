import { type Kysely, sql } from "kysely";

// Renames the Team concept to Group: table `team` -> `group`, join table
// `student_to_team` -> `student_to_group` (its `team_id` column -> `group_id`),
// `submission.team_id` -> `group_id`, and the `submission_type` enum value
// `'team'` -> `'group'`.
//
// `group` is a SQL reserved word — every raw-SQL reference below quotes it
// (`"group"`); the schema builder quotes identifiers automatically.
//
// The `submission_type` enum *type name* and the `submission.type` column stay
// as-is here — only the `'team'` value moves. Renaming the type or the `type`
// column is a separate concern (the submission/grade-target axis), not this
// migration's.
//
// Renaming a UNIQUE/PRIMARY KEY constraint also renames its backing index, so
// index renames below cover only plain (non-constraint) indexes. Raw SQL for
// those: the schema builder has no index-rename API. This includes
// `team_project_id_idx` (created per-table by the `add_projects` migration)
// and `team_pkey` (Postgres's default identity-column primary key name):
// table renames never auto-rename these, so — same as `question_pkey` /
// `question_project_id_idx` in the question-to-rubric rename — they need an
// explicit rename alongside the table.
//
// No trigger or enforcement-function changes: neither `team`, `student_to_team`,
// nor `submission` carries a trigger.
//
// `submission_type_participant_check` (the CHECK referencing `type` and
// `team_id`) is left unrenamed and untouched: Postgres tracks CHECK constraint
// bodies by column attnum and enum OID, not by name, so both the column rename
// and the enum value rename update its stored expression automatically.

const CONSTRAINT_RENAMES: ReadonlyArray<readonly [string, string, string]> = [
	// [table (post table-rename), from, to]
	["group", "team_pkey", "group_pkey"],
	["group", "team_name_project_id_key", "group_name_project_id_key"],
	["group", "team_project_id_fkey", "group_project_id_fkey"],
	[
		"student_to_group",
		"student_to_team_student_id_fkey",
		"student_to_group_student_id_fkey",
	],
	[
		"student_to_group",
		"student_to_team_student_id_team_id_pkey",
		"student_to_group_student_id_group_id_pkey",
	],
	[
		"student_to_group",
		"student_to_team_team_id_fkey",
		"student_to_group_group_id_fkey",
	],
	["submission", "submission_team_id_fkey", "submission_group_id_fkey"],
];

const INDEX_RENAMES: ReadonlyArray<readonly [string, string]> = [
	// [from, to] — plain indexes only; constraint-backed indexes follow their
	// constraint automatically.
	["student_to_team_team_id_index", "student_to_group_group_id_index"],
	["submission_team_id_key", "submission_group_id_key"],
	["team_project_id_idx", "group_project_id_idx"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema.alterTable("team").renameTo("group").execute();
	await db.schema
		.alterTable("student_to_team")
		.renameTo("student_to_group")
		.execute();
	await db.schema
		.alterTable("student_to_group")
		.renameColumn("team_id", "group_id")
		.execute();
	await db.schema
		.alterTable("submission")
		.renameColumn("team_id", "group_id")
		.execute();

	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(from, to).execute();
	}
	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(from)} RENAME TO ${sql.id(to)}`.execute(db);
	}

	await db.schema
		.alterType("submission_type")
		.renameValue("team", "group")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterType("submission_type")
		.renameValue("group", "team")
		.execute();

	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(to)} RENAME TO ${sql.id(from)}`.execute(db);
	}
	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(to, from).execute();
	}

	await db.schema
		.alterTable("submission")
		.renameColumn("group_id", "team_id")
		.execute();
	await db.schema
		.alterTable("student_to_group")
		.renameColumn("group_id", "team_id")
		.execute();
	await db.schema
		.alterTable("student_to_group")
		.renameTo("student_to_team")
		.execute();
	await db.schema.alterTable("group").renameTo("team").execute();
}
