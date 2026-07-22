import "server-only";
import { once } from "node:events";
import { stringify } from "csv-stringify";
import type { Kysely } from "kysely";
import { attachGrade, markCriterion } from "#criteria/criterion.ts";
import { getCriterionExportGradeValue } from "#criteria/criterionExport.ts";
import type { CriterionGrade } from "#criteria/types.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import type { GradeTargetIdentity } from "#grade-targets/types.ts";
import { loadRubricRowsFromDb, toCriterion } from "#rubrics/rubrics.ts";
import {
	buildGradeKey,
	buildGradeTargetExportHeaders,
	buildGradeTargetExportRecord,
	type ExportOptions,
	type ExportRubricPlan,
	type GradeTargetExportCriterionData,
	type GradeTargetExportDataRow,
	type GradeTargetExportRecord,
	type GradeTargetExportRubricData,
} from "./gradeTargetExportCsv.ts";
import {
	type GradeTargetExportRow,
	type GroupedGradeTargetRow,
	groupGradeTargetRows,
} from "./gradeTargetExportGrouping.ts";

// Derives every target's export identity from name + membership (ADR 0014),
// keyed by public id, in one bounded pass — targets are far fewer than the
// criterion grades streamed below, so holding them in a map avoids joining
// (and row-multiplying) membership into the grade stream. Individual: the sole
// member's public student id. Group: the Group Name, falling back to joined
// member names when unnamed. A memberless target is a broken invariant and
// fails loudly rather than exporting an unlabelled row.
async function loadGradeTargetIdentitiesFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
): Promise<Map<string, GradeTargetIdentity>> {
	const gridRowIdQuery = db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId);

	const [targets, memberRows] = await Promise.all([
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.gridRowId", "in", gridRowIdQuery)
			.select(["gradeTarget.id as id", "gradeTarget.name as name"])
			.execute(),
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.gridRowId", "in", gridRowIdQuery)
			.innerJoin(
				"gradeTargetStudent",
				"gradeTargetStudent.gradeTargetRowId",
				"gradeTarget.rowId",
			)
			.innerJoin("student", "student.rowId", "gradeTargetStudent.studentRowId")
			.select([
				"gradeTarget.id as targetId",
				"student.id as studentId",
				"student.lastName as studentLastName",
				"student.firstName as studentFirstName",
			])
			.orderBy("gradeTarget.rowId", "asc")
			.orderBy("student.lastName", "asc")
			.orderBy("student.firstName", "asc")
			.execute(),
	]);

	const membersByTargetId = new Map<
		string,
		{ studentId: string; name: string }[]
	>();
	for (const row of memberRows) {
		const members = membersByTargetId.get(row.targetId) ?? [];
		members.push({
			studentId: row.studentId,
			name: `${row.studentLastName} ${row.studentFirstName}`.trim(),
		});
		membersByTargetId.set(row.targetId, members);
	}

	const identities = new Map<string, GradeTargetIdentity>();
	for (const target of targets) {
		const members = membersByTargetId.get(target.id) ?? [];
		const firstMember = members[0];
		if (firstMember == null) {
			throw new Error(
				`Grade target ${target.id} has no members. Every grade target must ` +
					"have at least one student; this row indicates corrupted data.",
			);
		}

		// Name-OR-multimember rule: a target is a Group when it has a name or
		// more than one member, and an Individual only when it has exactly one
		// member and no name.
		if (target.name != null || members.length > 1) {
			identities.set(target.id, {
				id: target.id,
				kind: "group",
				groupName:
					target.name ?? members.map((member) => member.name).join(", "),
			});
		} else {
			identities.set(target.id, {
				id: target.id,
				kind: "individual",
				studentId: firstMember.studentId,
			});
		}
	}

	return identities;
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
				"rubric.id as rubricId",
				"criterion.id as criterionId",
				"criterion.kind as kind",
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
	const identitiesByTargetId = await loadGradeTargetIdentitiesFromDb(db, {
		gridId,
	});

	const rubricRows = await loadRubricRowsFromDb(db, { gridId });
	const rubrics: ExportRubricPlan[] = rubricRows.map((row) => ({
		id: row.id,
		criteria: row.criteria.map(toCriterion),
	}));

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

				const grade = getCriterionExportGradeValue(gradedCriterion);
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

	// The identity snapshot above is eager, but the grade stream below only
	// runs when `rows` is consumed: a grade target committed between the two
	// reads (a concurrent import) is missing from the snapshot. Targets are
	// append-only — no deletion path exists, see `nextGradeTargetIds` — so a
	// reload always resolves such a late target. A still-missing id after the
	// reload is genuinely corrupted data and fails loudly.
	async function resolveIdentity(
		gradeTargetId: string,
	): Promise<GradeTargetIdentity> {
		const snapshot = identitiesByTargetId.get(gradeTargetId);
		if (snapshot != null) {
			return snapshot;
		}

		const reloaded = await loadGradeTargetIdentitiesFromDb(db, { gridId });
		for (const [id, identity] of reloaded) {
			identitiesByTargetId.set(id, identity);
		}

		const target = identitiesByTargetId.get(gradeTargetId);
		if (target == null) {
			throw new Error(
				`Grade target ${gradeTargetId} has grades but no resolved identity.`,
			);
		}
		return target;
	}

	function buildGroupExportRow(
		target: GradeTargetIdentity,
		group: GroupedGradeTargetRow,
	): GradeTargetExportDataRow {
		return { target, rubrics: buildRubricData(group.valuesByKey) };
	}

	async function* rows(): AsyncGenerator<GradeTargetExportDataRow> {
		const stream = streamGradeTargetExportRowsFromDb(db, { gridId });
		for await (const group of groupGradeTargetRows(stream)) {
			yield buildGroupExportRow(
				await resolveIdentity(group.gradeTargetId),
				group,
			);
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
