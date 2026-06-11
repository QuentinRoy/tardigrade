import type { AssessmentRubricValue } from "#assessments/types.ts";
import { buildAssessmentKey } from "./submissionExportCsv.ts";

export type SubmissionRow = {
	submissionId: number | null;
	submissionType: "team" | "individual" | null;
	teamName: string | null;
	studentId: string | null;
	questionId: string | null;
	rubricId: string | null;
	booleanPassed: boolean | null;
	ordinalSelectedLabel: string | null;
	numericalScore: string | number | null;
};

export type SubmissionGroup = {
	submissionId: number;
	submissionType: "team" | "individual";
	teamName: string | null;
	studentId: string | null;
	valuesByKey: Map<string, AssessmentRubricValue>;
};

function toNumber(value: string | number): number {
	if (typeof value === "number") return value;
	return parseFloat(value);
}

export async function* groupSubmissionRows(
	rows: AsyncIterable<SubmissionRow>,
): AsyncGenerator<SubmissionGroup> {
	let currentSubmissionId: number | null = null;
	let currentSubmissionType: "team" | "individual" | null = null;
	let currentTeamName: string | null = null;
	let currentStudentId: string | null = null;
	let currentValuesByKey = new Map<string, AssessmentRubricValue>();

	function flush(): SubmissionGroup {
		if (currentSubmissionId == null || currentSubmissionType == null) {
			throw new Error("Missing submission data while grouping.");
		}
		return {
			submissionId: currentSubmissionId,
			submissionType: currentSubmissionType,
			teamName: currentTeamName,
			studentId: currentStudentId,
			valuesByKey: currentValuesByKey,
		};
	}

	for await (const row of rows) {
		if (row.submissionId == null) continue;

		if (
			currentSubmissionId != null &&
			row.submissionId !== currentSubmissionId
		) {
			yield flush();
			currentValuesByKey = new Map();
		}

		currentSubmissionId = row.submissionId;
		currentSubmissionType = row.submissionType;
		currentTeamName = row.teamName;
		currentStudentId = row.studentId;

		if (row.questionId == null || row.rubricId == null) continue;

		const key = buildAssessmentKey(row.questionId, row.rubricId);

		if (row.booleanPassed != null) {
			currentValuesByKey.set(key, {
				rubricId: row.rubricId,
				type: "boolean",
				passed: row.booleanPassed,
			});
			continue;
		}

		if (row.ordinalSelectedLabel != null) {
			currentValuesByKey.set(key, {
				rubricId: row.rubricId,
				type: "ordinal",
				selectedLabel: row.ordinalSelectedLabel,
			});
			continue;
		}

		if (row.numericalScore != null) {
			currentValuesByKey.set(key, {
				rubricId: row.rubricId,
				type: "numerical",
				score: toNumber(row.numericalScore),
			});
		}
	}

	if (currentSubmissionId != null) {
		yield flush();
	}
}
