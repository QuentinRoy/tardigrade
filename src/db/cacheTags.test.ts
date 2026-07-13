import { expect, test } from "vitest";
import {
	gradeAggregateCacheTag,
	gradeCompletionForRubricCacheTag,
	gradeForGradeTargetCacheTag,
	gradeForGradeTargetRubricCacheTag,
	gradeImportCacheTag,
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

test("grade aggregate and import tags are distinct", () => {
	expect(gradeAggregateCacheTag()).toBe("grades");
	expect(gradeImportCacheTag()).toBe("grades:all");
});

test("grade scope tags nest from grade target to rubric", () => {
	expect(gradeForGradeTargetCacheTag("t-1")).toBe("grades:t-1");
	expect(
		gradeForGradeTargetRubricCacheTag({ targetId: "t-1", rubricId: "q-1" }),
	).toBe("grades:t-1:q-1");
});

test("gradeCompletionForRubricCacheTag scopes to the rubric", () => {
	expect(gradeCompletionForRubricCacheTag("q-1")).toBe("grades:rubric:q-1");
});
