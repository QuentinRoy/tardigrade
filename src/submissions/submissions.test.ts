import { expect, test, vi } from "vitest";
import { submissionsCacheTags } from "./submissions.ts";

vi.mock("server-only", () => ({}));

test("submissionsCacheTags declares the submissions tag", () => {
	expect(submissionsCacheTags()).toEqual(["submissions"]);
});
