import "server-only";
import { once } from "node:events";
import { stringify } from "csv-stringify";
import type { Kysely } from "kysely";
import { attachGrade, markCriterion } from "#criteria/criterion.ts";
import type { CriterionGrade, GradedCriterion } from "#criteria/types.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import type { GradeTargetIdentity } from "#grade-targets/types.ts";
import { loadRubricRowsFromDb, toCriterion } from "#rubrics/rubrics.ts";
import { assertNever } from "#utils/utils.ts";
import {
	buildGradeKey,
	buildGradeTargetExportHeaders,
	buildGradeTargetExportRecord,
	type ExportOptions,
	type ExportRubricPlan,
	type GradeTargetExportCriterionData,
	type GradeTargetExportDataRow,
	type GradeTargetExportGradeValue,
	type GradeTargetExportRecord,
	type GradeTargetExportRubricData,
} from "./gradeTargetExportCsv.ts";
import {
	type GradeTargetExportRow,
	type GroupedGradeTargetRow,
	groupGradeTargetRows,
} from "./gradeTargetExportGrouping.ts";

function toGradeTargetIdentity(params: {
	id: string;
	kind: "group" | "individual";
	groupName: string | null;
	studentId: string | null;
}): GradeTargetIdentity {
	if (params.kind === "group") {
		if (params.groupName == null || params.groupName.length === 0) {
			throw new Error(
				`Grade target ${params.id} has kind group but no group is linked.`,
			);
		}

		return { id: params.id, kind: "group", groupName: params.groupName };
	}

	if (params.studentId == null || params.studentId.length === 0) {
		throw new Error(
			`Grade target ${params.id} has kind individual but no student is linked.`,
		);
	}

	return { id: params.id, kind: "individual", studentId: params.studentId };
}

async function assertGradeTargetInvariantsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
) {
	const invalidTargets = await db
		.selectFrom("grid")
		.where("grid.id", "=", gridId)
		.leftJoin("gradeTarget", "grid.rowId", "gradeTarget.gridRowId")
		.select((expressionBuilder) => expressionBuilder.fn.countAll().as("count"))
		.where((expressionBuilder) =>
			expressionBuilder.or([
				expressionBuilder.and([
					expressionBuilder("kind", "=", "group"),
					expressionBuilder("groupRowId", "is", null),
				]),
				expressionBuilder.and([
					expressionBuilder("kind", "=", "individual"),
					expressionBuilder("studentRowId", "is", null),
				]),
			]),
		)
		.executeTakeFirstOrThrow();

	const invalidCount = Number(invalidTargets.count);

	if (invalidCount > 0) {
		throw new Error(
			`Unexpected grade target data: found ${invalidCount} grade targets without required owner.`,
		);
	}
}

function streamGradeTargetExportRowsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
): AsyncIterable<GradeTargetExportRow> {
	return (
		db
			.selectFrom("grid")
			.where("grid.id", "=", gridId)
			.leftJoin("gradeTarget", "grid.rowId", "gradeTarget.gridRowId")
			.leftJoin("group", "group.id", "gradeTarget.groupRowId")
			.leftJoin("student", "student.rowId", "gradeTarget.studentRowId")
			.leftJoin(
				"criterionGrade",
				"criterionGrade.gradeTargetRowId",
				"gradeTarget.rowId",
			)
			.leftJoin("criterion", "criterion.rowId", "criterionGrade.criterionId")
			.leftJoin("rubric", "rubric.rowId", "criterion.rubricId")
			.leftJoin(
				"checkCriterionGrade",
				"checkCriterionGrade.criterionGradeId",
				"criterionGrade.id",
			)
			.leftJoin(
				"optionsCriterionGrade",
				"optionsCriterionGrade.criterionGradeId",
				"criterionGrade.id",
			)
			.leftJoin(
				"numberCriterionGrade",
				"numberCriterionGrade.criterionGradeId",
				"criterionGrade.id",
			)
			.select([
				"gradeTarget.rowId as gradeTargetRowId",
				"gradeTarget.id as gradeTargetId",
				"gradeTarget.kind as gradeTargetKind",
				"group.name as groupName",
				"student.id as studentId",
				"rubric.id as rubricId",
				"criterion.id as criterionId",
				"checkCriterionGrade.passed as checkPassed",
				"optionsCriterionGrade.selectedLabel as optionsSelectedLabel",
				"numberCriterionGrade.value as numberValue",
			])
			// Creation order, not id order — see the ordering note in
			// gradeTargetExportGrouping.ts.
			.orderBy("gradeTarget.rowId", "asc")
			.orderBy("criterionGrade.id", "asc")
			.stream(200)
	);
}

export async function createGradeTargetExport(
	gridId: string,
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<{
	rubrics: ExportRubricPlan[];
	rows: AsyncGenerator<GradeTargetExportDataRow>;
}> {
	await assertGradeTargetInvariantsFromDb(db, { gridId });

	const rubricRows = await loadRubricRowsFromDb(db, { gridId });
	const rubrics: ExportRubricPlan[] = rubricRows.map((row) => ({
		id: row.id,
		criteria: row.criteria.map(toCriterion),
	}));

	function getGradeValue(
		criterion: GradedCriterion,
	): GradeTargetExportGradeValue | undefined {
		if (criterion.grade == null) {
			return undefined;
		}

		switch (criterion.kind) {
			case "check": {
				return criterion.grade.passed;
			}
			case "options": {
				return criterion.grade.selectedLabel;
			}
			case "number": {
				return criterion.grade.value;
			}
			default: {
				return assertNever(criterion);
			}
		}
	}

	function buildRubricData(
		valuesByKey: Map<string, CriterionGrade>,
	): GradeTargetExportRubricData[] {
		return rubrics.map((rubric) => ({
			rubricId: rubric.id,
			criteria: rubric.criteria.map((criterion) => {
				const gradedCriterion = attachGrade(
					criterion,
					valuesByKey.get(buildGradeKey(rubric.id, criterion.id)),
				);

				const rowCriterion: GradeTargetExportCriterionData = {
					criterionId: criterion.id,
				};

				const grade = getGradeValue(gradedCriterion);
				if (grade != null) {
					rowCriterion.grade = grade;
				}

				if (gradedCriterion.grade != null) {
					rowCriterion.marks = markCriterion(gradedCriterion);
				}

				return rowCriterion;
			}),
		}));
	}

	function buildGroupExportRow(
		group: GroupedGradeTargetRow,
	): GradeTargetExportDataRow {
		return {
			target: toGradeTargetIdentity({
				id: group.gradeTargetId,
				kind: group.gradeTargetKind,
				groupName: group.groupName,
				studentId: group.studentId,
			}),
			rubrics: buildRubricData(group.valuesByKey),
		};
	}

	async function* rows(): AsyncGenerator<GradeTargetExportDataRow> {
		const stream = streamGradeTargetExportRowsFromDb(db, { gridId });
		for await (const group of groupGradeTargetRows(stream)) {
			yield buildGroupExportRow(group);
		}
	}

	return { rubrics, rows: rows() };
}

async function* toGradeTargetExportRecords(params: {
	rows: AsyncIterable<GradeTargetExportDataRow>;
	options: ExportOptions;
}): AsyncGenerator<GradeTargetExportRecord> {
	for await (const row of params.rows) {
		yield buildGradeTargetExportRecord({ row, options: params.options });
	}
}

export function createCsvGradeTargetExportDataStream(params: {
	rubrics: ExportRubricPlan[];
	rows: AsyncIterable<GradeTargetExportDataRow>;
	options: ExportOptions;
}): ReadableStream<Uint8Array> {
	const headers = buildGradeTargetExportHeaders(params.rubrics, params.options);

	return createCsvGradeTargetExportStream({
		headers,
		rows: toGradeTargetExportRecords({
			rows: params.rows,
			options: params.options,
		}),
	});
}

export function createCsvGradeTargetExportStream(exportData: {
	headers: string[];
	rows: AsyncIterable<GradeTargetExportRecord>;
}): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			const stringifier = stringify({
				header: true,
				columns: exportData.headers,
				cast: { boolean: (value: boolean) => String(value) },
			});

			stringifier.on("data", (chunk: string | Buffer) => {
				if (typeof chunk === "string") {
					controller.enqueue(encoder.encode(chunk));
					return;
				}

				controller.enqueue(new Uint8Array(chunk));
			});

			stringifier.on("end", () => {
				controller.close();
			});

			stringifier.on("error", (error) => {
				controller.error(error);
			});

			try {
				for await (const row of exportData.rows) {
					if (!stringifier.write(row)) {
						await once(stringifier, "drain");
					}
				}

				stringifier.end();
			} catch (error) {
				const streamError =
					error instanceof Error
						? error
						: new Error("Failed to stream grade target CSV.");
				stringifier.destroy(streamError);
			}
		},
	});
}

export async function createCsvGradeTargetExport(
	options: ExportOptions,
	gridId: string,
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<ReadableStream<Uint8Array>> {
	const exportData = await createGradeTargetExport(gridId, { db });
	return createCsvGradeTargetExportDataStream({
		rubrics: exportData.rubrics,
		rows: exportData.rows,
		options,
	});
}
