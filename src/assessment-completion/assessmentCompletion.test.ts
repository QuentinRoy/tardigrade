import { describe, expect, it } from "vitest";
import { buildAssessmentCompletion } from "./assessmentCompletion.ts";

describe("buildAssessmentCompletion", () => {
	it("counts a fully assessed rubric as complete on both axes", () => {
		const result = buildAssessmentCompletion({
			targetIds: ["t1"],
			rubrics: [{ id: "q1", criterionCount: 1 }],
			assessmentCounts: [
				{ targetId: "t1", rubricId: "q1", assessmentCount: 1 },
			],
		});

		expect(result.totalGradeTargets).toBe(1);
		expect(result.totalRubrics).toBe(1);
		expect(result.completedRubricCountByTargetId.get("t1")).toBe(1);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(1);
		expect(result.completedGradeTargets).toBe(1);
		expect(result.completedRubrics).toBe(1);
	});

	it("does not count a partially assessed rubric on either axis", () => {
		const result = buildAssessmentCompletion({
			targetIds: ["t1"],
			rubrics: [{ id: "q1", criterionCount: 2 }],
			assessmentCounts: [
				{ targetId: "t1", rubricId: "q1", assessmentCount: 1 },
			],
		});

		expect(result.completedRubricCountByTargetId.get("t1")).toBe(0);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(0);
		expect(result.completedGradeTargets).toBe(0);
		expect(result.completedRubrics).toBe(0);
	});

	it("counts a zero-criterion rubric as complete on both axes", () => {
		const result = buildAssessmentCompletion({
			targetIds: ["t1"],
			rubrics: [{ id: "q1", criterionCount: 0 }],
			assessmentCounts: [],
		});

		expect(result.completedRubricCountByTargetId.get("t1")).toBe(1);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(1);
		expect(result.completedGradeTargets).toBe(1);
		expect(result.completedRubrics).toBe(1);
	});

	it("treats an empty grade target grouping as vacuously complete on the rubric axis", () => {
		const result = buildAssessmentCompletion({
			targetIds: [],
			rubrics: [{ id: "q1", criterionCount: 1 }],
			assessmentCounts: [],
		});

		expect(result.completedRubrics).toBe(result.totalRubrics);
		expect(result.completedRubrics).toBe(1);
	});

	it("treats an empty rubric grouping as vacuously complete on the grade target axis", () => {
		const result = buildAssessmentCompletion({
			targetIds: ["t1"],
			rubrics: [],
			assessmentCounts: [],
		});

		expect(result.completedGradeTargets).toBe(result.totalGradeTargets);
		expect(result.completedGradeTargets).toBe(1);
	});

	it("keeps a grade target with no assessment rows at zero plus zero-criterion credit, and clamps overshooting counts", () => {
		const result = buildAssessmentCompletion({
			targetIds: ["t1"],
			rubrics: [
				{ id: "q1", criterionCount: 1 },
				{ id: "q2", criterionCount: 0 },
			],
			assessmentCounts: [
				// q3 doesn't exist among rubrics; an overshooting count for q1
				{ targetId: "t1", rubricId: "q1", assessmentCount: 5 },
			],
		});

		expect(result.completedRubricCountByTargetId.get("t1")).toBe(2);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(1);
		expect(result.completedGradeTargetCountByRubricId.get("q2")).toBe(1);
		expect(result.completedGradeTargets).toBe(1);
		expect(result.completedRubrics).toBe(2);
	});
});
