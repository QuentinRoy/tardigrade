import "server-only";
import type { Kysely } from "kysely";
import { cacheLife } from "next/cache";
import type { AssessmentCriterionValue } from "#criteria/types.ts";
import {
	assessmentForGradeTargetCacheTag,
	assessmentForGradeTargetRubricCacheTag,
	assessmentImportCacheTag,
	cacheTags,
} from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import { assertNever, nonNull } from "#utils/utils.ts";

export function loadAssessmentCacheTags({
	targetId,
	rubricId,
}: {
	targetId: string;
	rubricId?: string | undefined;
}) {
	// The granular (or target-scoped) tag refreshes on individual saves;
	// the import tag refreshes on bulk imports.
	const scopeTag =
		rubricId == null
			? assessmentForGradeTargetCacheTag(targetId)
			: assessmentForGradeTargetRubricCacheTag({ targetId, rubricId });
	return [scopeTag, assessmentImportCacheTag()];
}

// Returns the typed criterion values for a single grade-target/rubric assessment.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadRubricAssessment(
	{
		targetId,
		projectId,
		rubricId,
	}: { targetId: string; projectId: string; rubricId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<AssessmentCriterionValue[]> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags({ targetId, rubricId }));
	cacheLife("values");
	return loadRubricAssessmentFromDb(db, { targetId, projectId, rubricId });
}

// Returns every rubric's criterion values for a grade target in one query, keyed
// by Rubric ID. Lets the grade-target overview load all assessments at once
// instead of issuing one request per rubric.
// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadGradeTargetAssessments(
	{ targetId, projectId }: { targetId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<Record<string, AssessmentCriterionValue[]>> {
	"use cache";
	cacheTags(...loadAssessmentCacheTags({ targetId }));
	cacheLife("values");
	return loadGradeTargetAssessmentsFromDb(db, { targetId, projectId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadRubricAssessmentFromDb(
	db: Kysely<Database>,
	{
		targetId,
		projectId,
		rubricId,
	}: { targetId: string; projectId: string; rubricId: string },
): Promise<AssessmentCriterionValue[]> {
	const rows = await loadCriterionAssessmentRows(db, {
		targetId,
		projectId,
		rubricId,
	});

	const values: AssessmentCriterionValue[] = [];
	for (const row of rows) {
		const value = toCriterionValue(row);
		if (value != null) {
			values.push(value);
		}
	}
	return values;
}

// `db` may be the global client or a caller-supplied transaction.
export async function loadGradeTargetAssessmentsFromDb(
	db: Kysely<Database>,
	{ targetId, projectId }: { targetId: string; projectId: string },
): Promise<Record<string, AssessmentCriterionValue[]>> {
	const rows = await loadCriterionAssessmentRows(db, { targetId, projectId });

	const valuesByRubricId: Record<string, AssessmentCriterionValue[]> = {};
	for (const row of rows) {
		const value = toCriterionValue(row);
		if (value != null) {
			const values = valuesByRubricId[row.rubricId] ?? [];
			values.push(value);
			valuesByRubricId[row.rubricId] = values;
		}
	}
	return valuesByRubricId;
}

type CriterionAssessmentRow = {
	rubricId: string;
	criterionId: string;
	kind: AssessmentCriterionValue["kind"];
	passed: boolean | null;
	selectedLabel: string | null;
	score: number | string | null;
};

// Loads one row per stored criterion assessment for a grade target, optionally
// scoped to a single rubric. Filtering by Project ID disambiguates grade
// targets and rubrics that share public ids across projects.
async function loadCriterionAssessmentRows(
	db: Kysely<Database>,
	{
		targetId,
		projectId,
		rubricId,
	}: { targetId: string; projectId: string; rubricId?: string | undefined },
): Promise<CriterionAssessmentRow[]> {
	return db
		.selectFrom("criterionAssessment")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionAssessment.gradeTargetRowId",
		)
		.innerJoin("project", "project.rowId", "gradeTarget.projectId")
		.innerJoin(
			"criterion",
			"criterion.rowId",
			"criterionAssessment.criterionId",
		)
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
		.leftJoin(
			"checkCriterionAssessment",
			"checkCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.leftJoin(
			"optionsCriterionAssessment",
			"optionsCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.leftJoin(
			"numberCriterionAssessment",
			"numberCriterionAssessment.criterionAssessmentId",
			"criterionAssessment.id",
		)
		.where("project.id", "=", projectId)
		.where("gradeTarget.id", "=", targetId)
		.$if(rubricId != null, (qb) =>
			qb.where("rubric.id", "=", nonNull(rubricId)),
		)
		.select([
			"rubric.id as rubricId",
			"criterion.id as criterionId",
			"criterion.kind as kind",
			"checkCriterionAssessment.passed as passed",
			"optionsCriterionAssessment.selectedLabel as selectedLabel",
			"numberCriterionAssessment.score as score",
		])
		.execute();
}

function toCriterionValue(
	row: CriterionAssessmentRow,
): AssessmentCriterionValue | null {
	switch (row.kind) {
		case "check": {
			if (row.passed == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "check",
				passed: row.passed,
			};
		}
		case "options": {
			if (row.selectedLabel == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "options",
				selectedLabel: row.selectedLabel,
			};
		}
		case "number": {
			if (row.score == null) {
				return null;
			}
			return {
				criterionId: row.criterionId,
				kind: "number",
				score:
					typeof row.score === "number"
						? row.score
						: parseFloat(String(row.score)),
			};
		}
		default: {
			return assertNever(row.kind);
		}
	}
}
