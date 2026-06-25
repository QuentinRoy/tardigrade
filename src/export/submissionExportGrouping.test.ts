import { describe, expect, it } from "vitest";
import {
	groupSubmissionRows,
	type SubmissionRow,
} from "./submissionExportGrouping.ts";

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
	for (const item of items) {
		yield item;
	}
}

type GroupedSubmissionRow = Awaited<
	ReturnType<typeof groupSubmissionRows> extends AsyncGenerator<infer T>
		? T
		: never
>;

async function collectGroups(
	rows: SubmissionRow[],
): Promise<GroupedSubmissionRow[]> {
	const result: GroupedSubmissionRow[] = [];
	for await (const group of groupSubmissionRows(fromArray(rows))) {
		result.push(group);
	}
	return result;
}

const baseRow: SubmissionRow = {
	submissionId: 1,
	submissionType: "individual",
	teamName: null,
	studentId: "student-1",
	questionId: null,
	rubricId: null,
	booleanPassed: null,
	ordinalSelectedLabel: null,
	numericalScore: null,
};

describe("groupSubmissionRows", () => {
	it("yields one group for a single submission with no assessments", async () => {
		const groups = await collectGroups([baseRow]);

		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({
			submissionId: 1,
			submissionType: "individual",
			studentId: "student-1",
			teamName: null,
		});
		expect(groups[0]!.valuesByKey.size).toBe(0);
	});

	it("detects boundary and yields a separate group per submission", async () => {
		const rows: SubmissionRow[] = [
			{ ...baseRow, submissionId: 1, studentId: "s1" },
			{ ...baseRow, submissionId: 2, studentId: "s2" },
		];
		const groups = await collectGroups(rows);

		expect(groups).toHaveLength(2);
		expect(groups[0]!.submissionId).toBe(1);
		expect(groups[1]!.submissionId).toBe(2);
	});

	it("flushes the last group even without a following row", async () => {
		const rows: SubmissionRow[] = [
			{ ...baseRow, submissionId: 1, studentId: "s1" },
			{ ...baseRow, submissionId: 2, studentId: "s2" },
		];
		const groups = await collectGroups(rows);

		expect(groups[1]!.submissionId).toBe(2);
	});

	it("yields empty generator for empty input", async () => {
		const groups = await collectGroups([]);

		expect(groups).toHaveLength(0);
	});

	it("classifies boolean, ordinal, and numerical values into valuesByKey", async () => {
		const rows: SubmissionRow[] = [
			{
				...baseRow,
				questionId: "q1",
				rubricId: "r-bool",
				booleanPassed: true,
				ordinalSelectedLabel: null,
				numericalScore: null,
			},
			{
				...baseRow,
				questionId: "q1",
				rubricId: "r-ord",
				booleanPassed: null,
				ordinalSelectedLabel: "A",
				numericalScore: null,
			},
			{
				...baseRow,
				questionId: "q1",
				rubricId: "r-num",
				booleanPassed: null,
				ordinalSelectedLabel: null,
				numericalScore: 7.5,
			},
		];
		const groups = await collectGroups(rows);

		expect(groups).toHaveLength(1);
		const values = groups[0]!.valuesByKey;
		expect(values.get("q1::r-bool")).toEqual({
			rubricId: "r-bool",
			type: "boolean",
			passed: true,
		});
		expect(values.get("q1::r-ord")).toEqual({
			rubricId: "r-ord",
			type: "ordinal",
			selectedLabel: "A",
		});
		expect(values.get("q1::r-num")).toEqual({
			rubricId: "r-num",
			type: "numerical",
			score: 7.5,
		});
	});

	it("handles sparse assessments — rows with null questionId/rubricId contribute no values", async () => {
		const rows: SubmissionRow[] = [
			{ ...baseRow, questionId: null, rubricId: null },
			{
				...baseRow,
				questionId: "q1",
				rubricId: "r-bool",
				booleanPassed: false,
			},
		];
		const groups = await collectGroups(rows);

		expect(groups).toHaveLength(1);
		expect(groups[0]!.valuesByKey.size).toBe(1);
	});

	it("converts numeric string scores to numbers", async () => {
		const rows: SubmissionRow[] = [
			{
				...baseRow,
				questionId: "q1",
				rubricId: "r-num",
				numericalScore: "3.75",
			},
		];
		const groups = await collectGroups(rows);

		expect(groups[0]!.valuesByKey.get("q1::r-num")).toMatchObject({
			type: "numerical",
			score: 3.75,
		});
	});

	it("preserves input order across multiple submissions", async () => {
		const rows: SubmissionRow[] = [
			{ ...baseRow, submissionId: 10, studentId: "s10" },
			{ ...baseRow, submissionId: 20, studentId: "s20" },
			{ ...baseRow, submissionId: 30, studentId: "s30" },
		];
		const groups = await collectGroups(rows);

		expect(groups.map((g) => g.submissionId)).toEqual([10, 20, 30]);
	});
});
