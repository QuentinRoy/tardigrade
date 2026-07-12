import { expect, test } from "vitest";
import {
	assessmentAggregateCacheTag,
	assessmentForGradeTargetCacheTag,
	assessmentForGradeTargetRubricCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForRubricCacheTag,
	gradeTargetListCacheTag,
	projectCacheTag,
	projectListCacheTag,
	rubricListCacheTag,
} from "./cacheTags.ts";

test("list tags name their entity collection", () => {
	expect(projectListCacheTag()).toBe("projects");
	expect(rubricListCacheTag()).toBe("rubrics");
	expect(gradeTargetListCacheTag()).toBe("grade-targets");
});

test("projectCacheTag scopes to the public Project ID", () => {
	expect(projectCacheTag("p-1")).toBe("projects:p-1");
});

test("assessment aggregate and import tags are distinct", () => {
	expect(assessmentAggregateCacheTag()).toBe("assessments");
	expect(assessmentImportCacheTag()).toBe("assessments:all");
});

test("assessment scope tags nest from grade target to rubric", () => {
	expect(assessmentForGradeTargetCacheTag("t-1")).toBe("assessments:t-1");
	expect(
		assessmentForGradeTargetRubricCacheTag({
			targetId: "t-1",
			rubricId: "q-1",
		}),
	).toBe("assessments:t-1:q-1");
});

test("assessmentProgressForRubricCacheTag scopes to the rubric", () => {
	expect(assessmentProgressForRubricCacheTag("q-1")).toBe(
		"assessments:rubric:q-1",
	);
});
