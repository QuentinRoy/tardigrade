import { expect, test } from "vitest";
import { rubricOverviewCacheTags } from "./loadRubricOverview.ts";

test("rubricOverviewCacheTags declares the coarse question, submission and assessment tags", () => {
	expect(rubricOverviewCacheTags()).toEqual([
		"questions",
		"submissions",
		"assessments",
	]);
});
