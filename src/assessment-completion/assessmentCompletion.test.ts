import { describe, expect, it } from "vitest";
import { buildAssessmentCompletion } from "./assessmentCompletion.ts";

describe("buildAssessmentCompletion", () => {
	it("counts a fully assessed question as complete on both axes", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			questions: [{ id: "q1", rubricCount: 1 }],
			assessmentCounts: [
				{ submissionId: "s1", questionId: "q1", assessmentCount: 1 },
			],
		});

		expect(result.totalSubmissions).toBe(1);
		expect(result.totalQuestions).toBe(1);
		expect(result.completedQuestionCountBySubmissionId.get("s1")).toBe(1);
		expect(result.completedSubmissionCountByQuestionId.get("q1")).toBe(1);
		expect(result.completedSubmissions).toBe(1);
		expect(result.completedQuestions).toBe(1);
	});

	it("does not count a partially assessed question on either axis", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			questions: [{ id: "q1", rubricCount: 2 }],
			assessmentCounts: [
				{ submissionId: "s1", questionId: "q1", assessmentCount: 1 },
			],
		});

		expect(result.completedQuestionCountBySubmissionId.get("s1")).toBe(0);
		expect(result.completedSubmissionCountByQuestionId.get("q1")).toBe(0);
		expect(result.completedSubmissions).toBe(0);
		expect(result.completedQuestions).toBe(0);
	});

	it("counts a zero-rubric question as complete on both axes", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			questions: [{ id: "q1", rubricCount: 0 }],
			assessmentCounts: [],
		});

		expect(result.completedQuestionCountBySubmissionId.get("s1")).toBe(1);
		expect(result.completedSubmissionCountByQuestionId.get("q1")).toBe(1);
		expect(result.completedSubmissions).toBe(1);
		expect(result.completedQuestions).toBe(1);
	});

	it("treats an empty submission grouping as vacuously complete on the question axis", () => {
		const result = buildAssessmentCompletion({
			submissionIds: [],
			questions: [{ id: "q1", rubricCount: 1 }],
			assessmentCounts: [],
		});

		expect(result.completedQuestions).toBe(result.totalQuestions);
		expect(result.completedQuestions).toBe(1);
	});

	it("treats an empty question grouping as vacuously complete on the submission axis", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			questions: [],
			assessmentCounts: [],
		});

		expect(result.completedSubmissions).toBe(result.totalSubmissions);
		expect(result.completedSubmissions).toBe(1);
	});

	it("keeps a submission with no assessment rows at zero plus zero-rubric credit, and clamps overshooting counts", () => {
		const result = buildAssessmentCompletion({
			submissionIds: ["s1"],
			questions: [
				{ id: "q1", rubricCount: 1 },
				{ id: "q2", rubricCount: 0 },
			],
			assessmentCounts: [
				// q3 doesn't exist among questions; an overshooting count for q1
				{ submissionId: "s1", questionId: "q1", assessmentCount: 5 },
			],
		});

		expect(result.completedQuestionCountBySubmissionId.get("s1")).toBe(2);
		expect(result.completedSubmissionCountByQuestionId.get("q1")).toBe(1);
		expect(result.completedSubmissionCountByQuestionId.get("q2")).toBe(1);
		expect(result.completedSubmissions).toBe(1);
		expect(result.completedQuestions).toBe(2);
	});
});
