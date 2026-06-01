import { describe, expect, it } from "vitest";
import { findDuplicateGroups } from "./utils";

describe("findDuplicateGroups", () => {
	it("groups primitives by value", () => {
		expect(findDuplicateGroups(["a", "b", "b", "a"])).toEqual([
			{ key: "a", indexes: [0, 3] },
			{ key: "b", indexes: [1, 2] },
		]);
	});

	it("returns groups in first-key-seen order", () => {
		expect(findDuplicateGroups(["b", "a", "a", "b"])).toEqual([
			{ key: "b", indexes: [0, 3] },
			{ key: "a", indexes: [1, 2] },
		]);
	});

	it("returns indexes in ascending encounter order", () => {
		expect(findDuplicateGroups(["x", "y", "x", "y", "x"])).toEqual([
			{ key: "x", indexes: [0, 2, 4] },
			{ key: "y", indexes: [1, 3] },
		]);
	});

	it("omits values that appear only once", () => {
		expect(findDuplicateGroups(["a", "b", "a", "c"])).toEqual([
			{ key: "a", indexes: [0, 2] },
		]);
	});

	it("returns an empty array when there are no duplicates", () => {
		expect(findDuplicateGroups(["a", "b", "c"])).toEqual([]);
	});

	it("returns an empty array for empty input", () => {
		expect(findDuplicateGroups([])).toEqual([]);
	});

	it("compares objects by reference by default", () => {
		const shared = { id: 1 };
		const equalButDistinct = { id: 1 };

		expect(findDuplicateGroups([shared, equalButDistinct, shared])).toEqual([
			{ key: shared, indexes: [0, 2] },
		]);
	});

	it("treats NaN occurrences as the same key", () => {
		expect(findDuplicateGroups([Number.NaN, 1, Number.NaN])).toEqual([
			{ key: Number.NaN, indexes: [0, 2] },
		]);
	});

	it("consumes arbitrary iterables", () => {
		function* values() {
			yield "a";
			yield "a";
			yield "b";
		}

		expect(findDuplicateGroups(values())).toEqual([
			{ key: "a", indexes: [0, 1] },
		]);
	});

	describe("with getKey", () => {
		it("normalizes values before grouping", () => {
			expect(
				findDuplicateGroups([" A ", "", "a"], (value) => {
					const key = value.trim().toLowerCase();
					return key.length === 0 ? undefined : key;
				}),
			).toEqual([{ key: "a", indexes: [0, 2] }]);
		});

		it("ignores entries whose key is undefined", () => {
			expect(
				findDuplicateGroups(["keep", "skip", "keep", "skip"], (value) =>
					value === "skip" ? undefined : value,
				),
			).toEqual([{ key: "keep", indexes: [0, 2] }]);
		});

		it("passes the encounter index to getKey", () => {
			const seen: Array<[string, number]> = [];

			findDuplicateGroups(["a", "b"], (value, index) => {
				seen.push([value, index]);
				return value;
			});

			expect(seen).toEqual([
				["a", 0],
				["b", 1],
			]);
		});

		it("groups objects by a derived key", () => {
			const users = [
				{ email: "a@example.com", name: "Ann" },
				{ email: "b@example.com", name: "Bob" },
				{ email: "a@example.com", name: "Andy" },
			];

			expect(findDuplicateGroups(users, (user) => user.email)).toEqual([
				{ key: "a@example.com", indexes: [0, 2] },
			]);
		});
	});
});
