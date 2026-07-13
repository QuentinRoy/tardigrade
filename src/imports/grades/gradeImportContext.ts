import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { ImportedGradeRow } from "#imports/types.ts";
import {
	type GradeImportContext,
	type GradeImportCriterion,
	gradedCriterionKey,
	targetLookupKey,
} from "./prepareGradeImport.ts";

async function loadCriteriaByColumn(
	db: Kysely<Database>,
	projectRowId: number,
): Promise<Map<string, GradeImportCriterion>> {
	const criterionRows = await db
		.selectFrom("criterion")
		.innerJoin("rubric", "rubric.rowId", "criterion.rubricId")
		.leftJoin(
			"optionsCriterion",
			"optionsCriterion.criterionId",
			"criterion.rowId",
		)
		.leftJoin(
			"optionsCriterionMark",
			"optionsCriterionMark.optionsCriterionId",
			"optionsCriterion.id",
		)
		.where("criterion.projectId", "=", projectRowId)
		.select([
			"criterion.id",
			"criterion.kind",
			"rubric.id as rubricId",
			"optionsCriterionMark.label",
		])
		.execute();

	const criteriaByColumn = new Map<string, GradeImportCriterion>();

	for (const row of criterionRows) {
		const column = `${row.rubricId}:${row.id}`;
		const existing = criteriaByColumn.get(column);

		if (existing == null) {
			criteriaByColumn.set(column, {
				id: row.id,
				kind: row.kind,
				rubricId: row.rubricId,
				ordinalLabels: row.label == null ? [] : [row.label],
			});
		} else if (
			row.label != null &&
			!existing.ordinalLabels.includes(row.label)
		) {
			existing.ordinalLabels.push(row.label);
		}
	}

	return criteriaByColumn;
}

async function loadRubricIds(
	db: Kysely<Database>,
	projectRowId: number,
): Promise<Set<string>> {
	const rubrics = await db
		.selectFrom("rubric")
		.where("projectId", "=", projectRowId)
		.select("id")
		.execute();

	return new Set(rubrics.map((rubric) => rubric.id));
}

async function loadTargetIdsByLookup(
	db: Kysely<Database>,
	{ rows, projectRowId }: { rows: ImportedGradeRow[]; projectRowId: number },
): Promise<Map<string, string[]>> {
	const groupNames = new Set<string>();
	const individualStudentIds = new Set<string>();

	for (const row of rows) {
		if (row.kind === "group") {
			groupNames.add(row.name);
		} else {
			individualStudentIds.add(row.name);
		}
	}

	const [groupTargets, individualTargets] = await Promise.all([
		groupNames.size > 0
			? db
					.selectFrom("gradeTarget")
					.innerJoin("group", "group.id", "gradeTarget.groupRowId")
					.where("gradeTarget.kind", "=", "group")
					.where("gradeTarget.projectId", "=", projectRowId)
					.where("group.name", "in", Array.from(groupNames))
					.select(["group.name as name", "gradeTarget.id as targetId"])
					.execute()
			: Promise.resolve([]),
		individualStudentIds.size > 0
			? db
					.selectFrom("gradeTarget")
					.innerJoin("student", "student.rowId", "gradeTarget.studentRowId")
					.where("gradeTarget.kind", "=", "individual")
					.where("gradeTarget.projectId", "=", projectRowId)
					.where("student.id", "in", Array.from(individualStudentIds))
					.select(["student.id as name", "gradeTarget.id as targetId"])
					.execute()
			: Promise.resolve([]),
	]);

	const targetIdsByLookup = new Map<string, string[]>();

	function addTarget(key: string, targetId: string): void {
		const existing = targetIdsByLookup.get(key);
		if (existing) {
			existing.push(targetId);
		} else {
			targetIdsByLookup.set(key, [targetId]);
		}
	}

	for (const target of groupTargets) {
		addTarget(
			targetLookupKey({ targetKind: "group", name: target.name }),
			target.targetId,
		);
	}

	for (const target of individualTargets) {
		addTarget(
			targetLookupKey({ targetKind: "individual", name: target.name }),
			target.targetId,
		);
	}

	return targetIdsByLookup;
}

async function loadGradedCriterionKeys(
	db: Kysely<Database>,
	projectRowId: number,
): Promise<Set<string>> {
	const gradedPairs = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
		.where("gradeTarget.projectId", "=", projectRowId)
		.select(["gradeTarget.id as targetId", "criterion.id as criterionId"])
		.execute();

	return new Set(
		gradedPairs.map((pair) =>
			gradedCriterionKey({
				targetId: pair.targetId,
				criterionId: pair.criterionId,
			}),
		),
	);
}

// `db` may be the global client or a caller-supplied transaction. Fetches
// everything prepareGradeImport() needs, driven by the parsed rows.
export async function loadGradeImportContextFromDb(
	db: Kysely<Database>,
	{ rows, projectId }: { rows: ImportedGradeRow[]; projectId: string },
): Promise<GradeImportContext> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();
	const projectRowId = project.rowId;

	const [criteriaByColumn, rubricIds, targetIdsByLookup, gradedCriterionKeys] =
		await Promise.all([
			loadCriteriaByColumn(db, projectRowId),
			loadRubricIds(db, projectRowId),
			loadTargetIdsByLookup(db, { rows, projectRowId }),
			loadGradedCriterionKeys(db, projectRowId),
		]);

	return {
		criteriaByColumn,
		rubricIds,
		targetIdsByLookup,
		gradedCriterionKeys,
	};
}
