import { expect, test } from "vitest";
import { submissionsCacheTags } from "./submissions.ts";

test("submissionsCacheTags declares the submissions tag", () => {
	expect(submissionsCacheTags()).toEqual(["submissions"]);
});
