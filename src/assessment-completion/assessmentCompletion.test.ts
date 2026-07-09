import { describe, expect, it } from "vitest";
import { buildAssessmentCompletion } from "./assessmentCompletion.ts";

describe("buildAssessmentCompletion", () => {
	it("counts a fully assessed rubric as complete on both axes", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			rubrics: [{ id: "q1", criterionCount: 1 }],
			assessmentCounts: [
				{ submissionId: "s1", rubricId: "q1", assessmentCount: 1 },
			],
		});

		expect(result.totalSubmissions).toBe(1);
		expect(result.totalRubrics).toBe(1);
		expect(result.completedRubricCountBySubmissionId.get("s1")).toBe(1);
		expect(result.completedSubmissionCountByRubricId.get("q1")).toBe(1);
		expect(result.completedSubmissions).toBe(1);
		expect(result.completedRubrics).toBe(1);
	});

	it("does not count a partially assessed rubric on either axis", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			rubrics: [{ id: "q1", criterionCount: 2 }],
			assessmentCounts: [
				{ submissionId: "s1", rubricId: "q1", assessmentCount: 1 },
			],
		});

		expect(result.completedRubricCountBySubmissionId.get("s1")).toBe(0);
		expect(result.completedSubmissionCountByRubricId.get("q1")).toBe(0);
		expect(result.completedSubmissions).toBe(0);
		expect(result.completedRubrics).toBe(0);
	});

	it("counts a zero-criterion rubric as complete on both axes", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			rubrics: [{ id: "q1", criterionCount: 0 }],
			assessmentCounts: [],
		});

		expect(result.completedRubricCountBySubmissionId.get("s1")).toBe(1);
		expect(result.completedSubmissionCountByRubricId.get("q1")).toBe(1);
		expect(result.completedSubmissions).toBe(1);
		expect(result.completedRubrics).toBe(1);
	});

	it("treats an empty submission grouping as vacuously complete on the rubric axis", () => {
		const result = buildAssessmentCompletion({
			submissionIds: [],
			rubrics: [{ id: "q1", criterionCount: 1 }],
			assessmentCounts: [],
		});

		expect(result.completedRubrics).toBe(result.totalRubrics);
		expect(result.completedRubrics).toBe(1);
	});

	it("treats an empty rubric grouping as vacuously complete on the submission axis", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			rubrics: [],
			assessmentCounts: [],
		});

		expect(result.completedSubmissions).toBe(result.totalSubmissions);
		expect(result.completedSubmissions).toBe(1);
	});

	it("keeps a submission with no assessment rows at zero plus zero-criterion credit, and clamps overshooting counts", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			rubrics: [
				{ id: "q1", criterionCount: 1 },
				{ id: "q2", criterionCount: 0 },
			],
			assessmentCounts: [
				// q3 doesn't exist among rubrics; an overshooting count for q1
				{ submissionId: "s1", rubricId: "q1", assessmentCount: 5 },
			],
		});

		expect(result.completedRubricCountBySubmissionId.get("s1")).toBe(2);
		expect(result.completedSubmissionCountByRubricId.get("q1")).toBe(1);
		expect(result.completedSubmissionCountByRubricId.get("q2")).toBe(1);
		expect(result.completedSubmissions).toBe(1);
		expect(result.completedRubrics).toBe(2);
	});
});
