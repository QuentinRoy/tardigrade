import { expect, test, vi } from "vitest";
import { questionCacheTags } from "./questions.ts";

vi.mock("server-only", () => ({}));

test("questionCacheTags declares the questions tag", () => {
	expect(questionCacheTags()).toEqual(["questions"]);
});
