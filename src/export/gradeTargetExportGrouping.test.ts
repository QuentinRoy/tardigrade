import { describe, expect, it } from "vitest";
import {
	type GradeTargetExportRow,
	groupGradeTargetRows,
} from "./gradeTargetExportGrouping.ts";

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
	for (const item of items) {
		yield item;
	}
}

type GroupedRow = Awaited<
	ReturnType<typeof groupGradeTargetRows> extends AsyncGenerator<infer T>
		? T
		: never
>;

async function collectGroups(
	rows: GradeTargetExportRow[],
): Promise<GroupedRow[]> {
	const result: GroupedRow[] = [];
	for await (const group of groupGradeTargetRows(fromArray(rows))) {
		result.push(group);
	}
	return result;
}

const baseRow: GradeTargetExportRow = {
	gradeTargetRowId: 1,
	gradeTargetId: "t-1",
	gradeTargetKind: "individual",
	groupName: null,
	studentId: "student-1",
	rubricId: null,
	criterionId: null,
	kind: null,
	checkPassed: null,
	optionsSelectedLabel: null,
	numberValue: null,
};

describe("groupGradeTargetRows", () => {
	it("yields one group for a single grade target with no grades", async () => {
		const groups = await collectGroups([baseRow]);

		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({
			gradeTargetId: "t-1",
			gradeTargetKind: "individual",
			studentId: "student-1",
			groupName: null,
		});
		expect(groups[0]!.valuesByKey.size).toBe(0);
	});

	it("detects boundary and yields a separate group per grade target", async () => {
		const rows: GradeTargetExportRow[] = [
			{
				...baseRow,
				gradeTargetRowId: 1,
				gradeTargetId: "t-1",
				studentId: "s1",
			},
			{
				...baseRow,
				gradeTargetRowId: 2,
				gradeTargetId: "t-2",
				studentId: "s2",
			},
		];
		const groups = await collectGroups(rows);

		expect(groups).toHaveLength(2);
		expect(groups[0]!.gradeTargetId).toBe("t-1");
		expect(groups[1]!.gradeTargetId).toBe("t-2");
	});

	it("flushes the last group even without a following row", async () => {
		const rows: GradeTargetExportRow[] = [
			{
				...baseRow,
				gradeTargetRowId: 1,
				gradeTargetId: "t-1",
				studentId: "s1",
			},
			{
				...baseRow,
				gradeTargetRowId: 2,
				gradeTargetId: "t-2",
				studentId: "s2",
			},
		];
		const groups = await collectGroups(rows);

		expect(groups[1]!.gradeTargetId).toBe("t-2");
	});

	it("yields empty generator for empty input", async () => {
		const groups = await collectGroups([]);

		expect(groups).toHaveLength(0);
	});

	it("classifies check, options, and number values into valuesByKey", async () => {
		const rows: GradeTargetExportRow[] = [
			{
				...baseRow,
				rubricId: "q1",
				criterionId: "r-bool",
				kind: "check",
				checkPassed: true,
				optionsSelectedLabel: null,
				numberValue: null,
			},
			{
				...baseRow,
				rubricId: "q1",
				criterionId: "r-ord",
				kind: "options",
				checkPassed: null,
				optionsSelectedLabel: "A",
				numberValue: null,
			},
			{
				...baseRow,
				rubricId: "q1",
				criterionId: "r-num",
				kind: "number",
				checkPassed: null,
				optionsSelectedLabel: null,
				numberValue: 7.5,
			},
		];
		const groups = await collectGroups(rows);

		expect(groups).toHaveLength(1);
		const values = groups[0]!.valuesByKey;
		expect(values.get("q1::r-bool")).toEqual({
			criterionId: "r-bool",
			kind: "check",
			passed: true,
		});
		expect(values.get("q1::r-ord")).toEqual({
			criterionId: "r-ord",
			kind: "options",
			selectedLabel: "A",
		});
		expect(values.get("q1::r-num")).toEqual({
			criterionId: "r-num",
			kind: "number",
			value: 7.5,
		});
	});

	it("handles sparse grades — rows with null rubricId/criterionId contribute no values", async () => {
		const rows: GradeTargetExportRow[] = [
			{ ...baseRow, rubricId: null, criterionId: null },
			{
				...baseRow,
				rubricId: "q1",
				criterionId: "r-bool",
				kind: "check",
				checkPassed: false,
			},
		];
		const groups = await collectGroups(rows);

		expect(groups).toHaveLength(1);
		expect(groups[0]!.valuesByKey.size).toBe(1);
	});

	it("throws when a linked criterion has a grade but no kind", async () => {
		const rows: GradeTargetExportRow[] = [
			{
				...baseRow,
				rubricId: "q1",
				criterionId: "r-bool",
				kind: null,
				checkPassed: true,
			},
		];

		await expect(collectGroups(rows)).rejects.toThrow(
			"Grade export row for criterion r-bool has a grade but no criterion kind.",
		);
	});

	it("converts numeric string values to numbers", async () => {
		const rows: GradeTargetExportRow[] = [
			{
				...baseRow,
				rubricId: "q1",
				criterionId: "r-num",
				kind: "number",
				numberValue: "3.75",
			},
		];
		const groups = await collectGroups(rows);

		expect(groups[0]!.valuesByKey.get("q1::r-num")).toMatchObject({
			kind: "number",
			value: 3.75,
		});
	});

	it("preserves input order across multiple grade targets", async () => {
		const rows: GradeTargetExportRow[] = [
			{
				...baseRow,
				gradeTargetRowId: 10,
				gradeTargetId: "t-10",
				studentId: "s10",
			},
			{
				...baseRow,
				gradeTargetRowId: 20,
				gradeTargetId: "t-20",
				studentId: "s20",
			},
			{
				...baseRow,
				gradeTargetRowId: 30,
				gradeTargetId: "t-30",
				studentId: "s30",
			},
		];
		const groups = await collectGroups(rows);

		expect(groups.map((g) => g.gradeTargetId)).toEqual([
			"t-10",
			"t-20",
			"t-30",
		]);
	});
});
