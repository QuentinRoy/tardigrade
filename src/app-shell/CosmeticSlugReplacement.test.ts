import { describe, expect, it } from "vitest";
import { canonicalizeSlugSegment } from "./CosmeticSlugReplacement.tsx";

const id = "p-abc123";
const slug = "cs101";
const idIndex = 2;

describe("canonicalizeSlugSegment", () => {
	it("rewrites a stale slug segment", () => {
		expect(
			canonicalizeSlugSegment(`/projects/${id}/old-name`, idIndex, id, slug),
		).toBe(`/projects/${id}/cs101`);
	});

	it("returns null when the slug is already canonical", () => {
		expect(
			canonicalizeSlugSegment(`/projects/${id}/cs101`, idIndex, id, slug),
		).toBeNull();
	});

	it("throws when the segment at idIndex is not the expected id", () => {
		expect(() =>
			canonicalizeSlugSegment("/projects/p-other/cs101", idIndex, id, slug),
		).toThrow();
	});

	it("throws when the id is the last segment with no slug slot", () => {
		expect(() =>
			canonicalizeSlugSegment(`/projects/${id}`, idIndex, id, slug),
		).toThrow();
	});

	it("preserves deep path segments and the leading slash", () => {
		expect(
			canonicalizeSlugSegment(
				`/projects/${id}/old-name/grades/t-1/alice`,
				idIndex,
				id,
				slug,
			),
		).toBe(`/projects/${id}/cs101/grades/t-1/alice`);
	});

	it("addresses the slug by position, not by searching for the id's value", () => {
		// A per-project text id (a grade target's) is not globally unique, so an
		// earlier segment can legitimately equal it — e.g. a project slug that
		// happens to be literally "t-1". Positional addressing must still patch
		// the correct (idIndex + 1) slot, not the first matching value anywhere
		// in the path.
		const targetId = "t-1";
		const targetIdIndex = 5;

		expect(
			canonicalizeSlugSegment(
				`/projects/p-1/t-1/grades/${targetId}/old-name`,
				targetIdIndex,
				targetId,
				"alice-smith",
			),
		).toBe(`/projects/p-1/t-1/grades/${targetId}/alice-smith`);
	});
});
