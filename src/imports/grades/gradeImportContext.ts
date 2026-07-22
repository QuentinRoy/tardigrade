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
	gridRowId: number,
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
		.leftJoin(
			"numberCriterion",
			"numberCriterion.criterionId",
			"criterion.rowId",
		)
		.where("criterion.gridRowId", "=", gridRowId)
		.select([
			"criterion.id",
			"criterion.kind",
			"rubric.id as rubricId",
			"optionsCriterionMark.label",
			"numberCriterion.minValue",
			"numberCriterion.maxValue",
		])
		.execute();

	const criteriaByColumn = new Map<string, GradeImportCriterion>();

	for (const row of criterionRows) {
		const column = `${row.rubricId}:${row.id}`;
		const existing = criteriaByColumn.get(column);

		if (existing != null) {
			if (
				existing.kind === "options" &&
				row.label != null &&
				!existing.optionsLabels.includes(row.label)
			) {
				existing.optionsLabels.push(row.label);
			}
			continue;
		}

		const baseCriterion = { id: row.id, rubricId: row.rubricId };
		let criterion: GradeImportCriterion;

		switch (row.kind) {
			case "number":
				if (row.minValue == null || row.maxValue == null) {
					throw new Error(
						`Criterion Subtype Invariant violation: missing numberCriterion row for criterion ${row.id}.`,
					);
				}
				criterion = {
					...baseCriterion,
					kind: "number",
					minValue: row.minValue,
					maxValue: row.maxValue,
				};
				break;
			case "options":
				criterion = {
					...baseCriterion,
					kind: "options",
					optionsLabels: row.label == null ? [] : [row.label],
				};
				break;
			case "check":
				criterion = { ...baseCriterion, kind: "check" };
				break;
		}

		criteriaByColumn.set(column, criterion);
	}

	return criteriaByColumn;
}

async function loadRubricIds(
	db: Kysely<Database>,
	gridRowId: number,
): Promise<Set<string>> {
	const rubrics = await db
		.selectFrom("rubric")
		.where("gridRowId", "=", gridRowId)
		.select("id")
		.execute();

	return new Set(rubrics.map((rubric) => rubric.id));
}

async function loadTargetIdsByLookup(
	db: Kysely<Database>,
	{ rows, gridRowId }: { rows: ImportedGradeRow[]; gridRowId: number },
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

	// A group row matches a named target by its name; an individual row matches
	// the one-member unnamed target whose sole member is that student. Both
	// distinctions are derived from name + membership, not a stored kind.
	const [groupTargets, individualTargets] = await Promise.all([
		groupNames.size > 0
			? db
					.selectFrom("gradeTarget")
					.where("gradeTarget.gridRowId", "=", gridRowId)
					.where("gradeTarget.name", "in", Array.from(groupNames))
					.select(["gradeTarget.name as name", "gradeTarget.id as targetId"])
					.execute()
			: Promise.resolve([]),
		individualStudentIds.size > 0
			? db
					.selectFrom("gradeTarget as gt")
					.innerJoin(
						"gradeTargetStudent as gts",
						"gts.gradeTargetRowId",
						"gt.rowId",
					)
					.innerJoin("student", "student.rowId", "gts.studentRowId")
					.where("gt.gridRowId", "=", gridRowId)
					.where("gt.name", "is", null)
					.where("student.id", "in", Array.from(individualStudentIds))
					.where((eb) =>
						eb.not(
							eb.exists(
								eb
									.selectFrom("gradeTargetStudent as other")
									.whereRef(
										"other.gradeTargetRowId",
										"=",
										"gts.gradeTargetRowId",
									)
									.whereRef("other.studentRowId", "<>", "gts.studentRowId")
									.select("other.studentRowId"),
							),
						),
					)
					.select(["student.id as name", "gt.id as targetId"])
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
		if (target.name == null) {
			continue;
		}
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
	gridRowId: number,
): Promise<Set<string>> {
	const gradedPairs = await db
		.selectFrom("criterionGrade")
		.innerJoin(
			"gradeTarget",
			"gradeTarget.rowId",
			"criterionGrade.gradeTargetRowId",
		)
		.innerJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
		.where("gradeTarget.gridRowId", "=", gridRowId)
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
	{ rows, gridId }: { rows: ImportedGradeRow[]; gridId: string },
): Promise<GradeImportContext> {
	const grid = await db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId)
		.executeTakeFirstOrThrow();
	const gridRowId = grid.rowId;

	const [criteriaByColumn, rubricIds, targetIdsByLookup, gradedCriterionKeys] =
		await Promise.all([
			loadCriteriaByColumn(db, gridRowId),
			loadRubricIds(db, gridRowId),
			loadTargetIdsByLookup(db, { rows, gridRowId }),
			loadGradedCriterionKeys(db, gridRowId),
		]);

	return {
		criteriaByColumn,
		rubricIds,
		targetIdsByLookup,
		gradedCriterionKeys,
	};
}
