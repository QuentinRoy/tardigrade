import { describe, expect, it } from "vitest";
import { buildGradeCompletion } from "./gradeCompletion.ts";

describe("buildGradeCompletion", () => {
	it("counts a fully graded rubric as complete on both axes", () => {
		const result = buildGradeCompletion({
			targetIds: ["t1"],
			rubrics: [{ id: "q1", criterionCount: 1 }],
			gradeCounts: [{ targetId: "t1", rubricId: "q1", gradeCount: 1 }],
		});

		expect(result.totalGradeTargets).toBe(1);
		expect(result.totalRubrics).toBe(1);
		expect(result.completedRubricCountByTargetId.get("t1")).toBe(1);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(1);
		expect(result.completedGradeTargets).toBe(1);
		expect(result.completedRubrics).toBe(1);
	});

	it("does not count a partially graded rubric on either axis", () => {
		const result = buildGradeCompletion({
			targetIds: ["t1"],
			rubrics: [{ id: "q1", criterionCount: 2 }],
			gradeCounts: [{ targetId: "t1", rubricId: "q1", gradeCount: 1 }],
		});

		expect(result.completedRubricCountByTargetId.get("t1")).toBe(0);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(0);
		expect(result.completedGradeTargets).toBe(0);
		expect(result.completedRubrics).toBe(0);
	});

	it("counts a zero-criterion rubric as complete on both axes", () => {
		const result = buildGradeCompletion({
			targetIds: ["t1"],
			rubrics: [{ id: "q1", criterionCount: 0 }],
			gradeCounts: [],
		});

		expect(result.completedRubricCountByTargetId.get("t1")).toBe(1);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(1);
		expect(result.completedGradeTargets).toBe(1);
		expect(result.completedRubrics).toBe(1);
	});

	it("treats an empty grade target grouping as vacuously complete on the rubric axis", () => {
		const result = buildGradeCompletion({
			targetIds: [],
			rubrics: [{ id: "q1", criterionCount: 1 }],
			gradeCounts: [],
		});

		expect(result.completedRubrics).toBe(result.totalRubrics);
		expect(result.completedRubrics).toBe(1);
	});

	it("treats an empty rubric grouping as vacuously complete on the grade target axis", () => {
		const result = buildGradeCompletion({
			targetIds: ["t1"],
			rubrics: [],
			gradeCounts: [],
		});

		expect(result.completedGradeTargets).toBe(result.totalGradeTargets);
		expect(result.completedGradeTargets).toBe(1);
	});

	it("keeps a grade target with no grade rows at zero plus zero-criterion credit, and clamps overshooting counts", () => {
		const result = buildGradeCompletion({
			targetIds: ["t1"],
			rubrics: [
				{ id: "q1", criterionCount: 1 },
				{ id: "q2", criterionCount: 0 },
			],
			gradeCounts: [
				// q3 doesn't exist among rubrics; an overshooting count for q1
				{ targetId: "t1", rubricId: "q1", gradeCount: 5 },
			],
		});

		expect(result.completedRubricCountByTargetId.get("t1")).toBe(2);
		expect(result.completedGradeTargetCountByRubricId.get("q1")).toBe(1);
		expect(result.completedGradeTargetCountByRubricId.get("q2")).toBe(1);
		expect(result.completedGradeTargets).toBe(1);
		expect(result.completedRubrics).toBe(2);
	});
});
