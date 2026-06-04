import { describe, expect, it } from "vitest";
import { canonicalizeSlugSegment } from "./CosmeticSlugReplacement.tsx";

const id = "p-abc123";
const slug = "cs101";

describe("canonicalizeSlugSegment", () => {
	it("rewrites a stale slug segment", () => {
		expect(canonicalizeSlugSegment(`/projects/${id}/old-name`, id, slug)).toBe(
			`/projects/${id}/cs101`,
		);
	});

	it("returns null when the slug is already canonical", () => {
		expect(
			canonicalizeSlugSegment(`/projects/${id}/cs101`, id, slug),
		).toBeNull();
	});

	it("throws when the id is absent from the pathname", () => {
		expect(() =>
			canonicalizeSlugSegment("/projects/p-other/cs101", id, slug),
		).toThrow();
	});

	it("throws when the id is the last segment with no slug slot", () => {
		expect(() =>
			canonicalizeSlugSegment(`/projects/${id}`, id, slug),
		).toThrow();
	});

	it("preserves deep path segments and the leading slash", () => {
		expect(
			canonicalizeSlugSegment(
				`/projects/${id}/old-name/assessments/submissions/sub_42`,
				id,
				slug,
			),
		).toBe(`/projects/${id}/cs101/assessments/submissions/sub_42`);
	});

	it("rewrites only the segment after the first id match", () => {
		// The id value also appears deeper (e.g. as a nested resource id); only
		// the slug slot after the first match is rewritten.
		expect(
			canonicalizeSlugSegment(
				`/projects/${id}/old-name/related/${id}`,
				id,
				slug,
			),
		).toBe(`/projects/${id}/cs101/related/${id}`);
	});
});
