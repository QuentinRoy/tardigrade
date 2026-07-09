import { expect, test } from "vitest";
import {
	assessmentAggregateCacheTag,
	assessmentForSubmissionCacheTag,
	assessmentForSubmissionRubricCacheTag,
	assessmentImportCacheTag,
	assessmentProgressForRubricCacheTag,
	projectCacheTag,
	projectListCacheTag,
	rubricListCacheTag,
	submissionListCacheTag,
} from "./cacheTags.ts";

test("list tags name their entity collection", () => {
	expect(projectListCacheTag()).toBe("projects");
	expect(rubricListCacheTag()).toBe("rubrics");
	expect(submissionListCacheTag()).toBe("submissions");
});

test("projectCacheTag scopes to the public Project ID", () => {
	expect(projectCacheTag("p-1")).toBe("projects:p-1");
});

test("assessment aggregate and import tags are distinct", () => {
	expect(assessmentAggregateCacheTag()).toBe("assessments");
	expect(assessmentImportCacheTag()).toBe("assessments:all");
});

test("assessment scope tags nest from submission to rubric", () => {
	expect(assessmentForSubmissionCacheTag("s-1")).toBe("assessments:s-1");
	expect(
		assessmentForSubmissionRubricCacheTag({
			submissionId: "s-1",
			rubricId: "q-1",
		}),
	).toBe("assessments:s-1:q-1");
});

test("assessmentProgressForRubricCacheTag scopes to the rubric", () => {
	expect(assessmentProgressForRubricCacheTag("q-1")).toBe(
		"assessments:rubric:q-1",
	);
});
