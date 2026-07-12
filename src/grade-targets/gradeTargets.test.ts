import { expect, test } from "vitest";
import { gradeTargetsCacheTags, toTargetSlug } from "./gradeTargets.ts";

test("gradeTargetsCacheTags declares the grade-targets tag", () => {
	expect(gradeTargetsCacheTags()).toEqual(["grade-targets"]);
});

test("toTargetSlug normalizes a display label into a URL-safe slug", () => {
	expect(toTargetSlug("Alice Smith")).toBe("alice-smith");
	expect(toTargetSlug("Group A")).toBe("group-a");
});

test("toTargetSlug throws on a label with no letters or numbers", () => {
	expect(() => toTargetSlug("---")).toThrow(
		"Grade target label must contain at least one letter or number.",
	);
});
