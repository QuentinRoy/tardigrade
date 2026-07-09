import { type Kysely, sql } from "kysely";

// One-time normalization: rename every remaining PascalCase constraint and
// index to its snake_case spelling (a mechanical case-fold of the existing
// name — no wording changes), so the whole catalog follows one convention.
//
// The PascalCase names are Prisma-era spellings that early migrations created
// verbatim via raw SQL or the (then plugin-less) schema builder. For a while
// the migration runners diverged on CamelCasePlugin, which forked some of
// these names between databases; the runners are now plugin-less everywhere,
// the pre-existing chain replays these exact PascalCase names on fresh
// databases, and this migration converges every database onto snake_case. From
// here on, constraint and index names are deterministic and snake_case, so
// later rename stages can use plain `renameConstraint` calls. See
// docs/reference/database-migrations.md.
//
// Renaming a UNIQUE/PRIMARY KEY constraint renames its backing index too, so
// the raw-SQL index renames below cover only plain (non-constraint) indexes.
// Raw SQL because the schema builder has no index-rename API.

const CONSTRAINT_RENAMES: ReadonlyArray<readonly [string, string, string]> = [
	// [table, from, to]
	["assessment", "Assessment_projectId_fkey", "assessment_project_id_fkey"],
	["assessment", "Assessment_rubricId_fkey", "assessment_rubric_id_fkey"],
	[
		"assessment",
		"Assessment_submissionId_fkey",
		"assessment_submission_id_fkey",
	],
	[
		"assessment",
		"Assessment_submissionId_rubricId_key",
		"assessment_submission_id_rubric_id_key",
	],
	[
		"check_criterion",
		"CheckCriterion_criterionId_fkey",
		"check_criterion_criterion_id_fkey",
	],
	[
		"check_criterion_assessment",
		"CheckCriterionAssessment_criterionAssessmentId_fkey",
		"check_criterion_assessment_criterion_assessment_id_fkey",
	],
	["criterion", "Criterion_projectId_fkey", "criterion_project_id_fkey"],
	["criterion", "Criterion_projectId_id_key", "criterion_project_id_id_key"],
	["criterion", "Criterion_rubricId_fkey", "criterion_rubric_id_fkey"],
	[
		"criterion",
		"Criterion_rubricId_position_key",
		"criterion_rubric_id_position_key",
	],
	[
		"criterion_assessment",
		"CriterionAssessment_assessmentId_criterionId_key",
		"criterion_assessment_assessment_id_criterion_id_key",
	],
	[
		"criterion_assessment",
		"CriterionAssessment_assessmentId_fkey",
		"criterion_assessment_assessment_id_fkey",
	],
	[
		"criterion_assessment",
		"CriterionAssessment_criterionId_fkey",
		"criterion_assessment_criterion_id_fkey",
	],
	[
		"number_criterion",
		"NumberCriterion_criterionId_fkey",
		"number_criterion_criterion_id_fkey",
	],
	[
		"number_criterion_assessment",
		"NumberCriterionAssessment_criterionAssessmentId_fkey",
		"number_criterion_assessment_criterion_assessment_id_fkey",
	],
	[
		"options_criterion",
		"OptionsCriterion_criterionId_fkey",
		"options_criterion_criterion_id_fkey",
	],
	[
		"options_criterion_assessment",
		"OptionsCriterionAssessment_criterionAssessmentId_fkey",
		"options_criterion_assessment_criterion_assessment_id_fkey",
	],
	[
		"options_criterion_mark",
		"OptionsCriterionMark_optionsCriterionId_fkey",
		"options_criterion_mark_options_criterion_id_fkey",
	],
	[
		"options_criterion_mark",
		"OptionsCriterionMark_optionsCriterionId_label_key",
		"options_criterion_mark_options_criterion_id_label_key",
	],
	["rubric", "Rubric_projectId_fkey", "rubric_project_id_fkey"],
	["rubric", "Rubric_projectId_id_key", "rubric_project_id_id_key"],
	["student", "Student_projectId_fkey", "student_project_id_fkey"],
	["student", "Student_projectId_id_key", "student_project_id_id_key"],
	[
		"student_to_team",
		"StudentToTeam_studentId_fkey",
		"student_to_team_student_id_fkey",
	],
	[
		"student_to_team",
		"StudentToTeam_studentId_teamId_pkey",
		"student_to_team_student_id_team_id_pkey",
	],
	[
		"student_to_team",
		"StudentToTeam_teamId_fkey",
		"student_to_team_team_id_fkey",
	],
	["submission", "Submission_projectId_fkey", "submission_project_id_fkey"],
	[
		"submission",
		"Submission_type_participant_check",
		"submission_type_participant_check",
	],
	["submission", "Submission_studentId_fkey", "submission_student_id_fkey"],
	["submission", "Submission_teamId_fkey", "submission_team_id_fkey"],
	["team", "Team_name_projectId_key", "team_name_project_id_key"],
	["team", "Team_projectId_fkey", "team_project_id_fkey"],
];

const INDEX_RENAMES: ReadonlyArray<readonly [string, string]> = [
	// [from, to] — plain indexes only; constraint-backed indexes follow their
	// constraint automatically.
	[
		"OptionsCriterionMark_optionsCriterionId_label_idx",
		"options_criterion_mark_options_criterion_id_label_idx",
	],
	["StudentToTeam_teamId_index", "student_to_team_team_id_index"],
	["Submission_studentId_key", "submission_student_id_key"],
	["Submission_teamId_key", "submission_team_id_key"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(from, to).execute();
	}
	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(from)} RENAME TO ${sql.id(to)}`.execute(db);
	}
}

export async function down(db: Kysely<unknown>): Promise<void> {
	for (const [from, to] of INDEX_RENAMES) {
		await sql`ALTER INDEX ${sql.id(to)} RENAME TO ${sql.id(from)}`.execute(db);
	}
	for (const [table, from, to] of CONSTRAINT_RENAMES) {
		await db.schema.alterTable(table).renameConstraint(to, from).execute();
	}
}
