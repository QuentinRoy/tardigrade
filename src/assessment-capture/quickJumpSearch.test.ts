import { describe, expect, it } from "vitest";
import type { GradeTarget } from "#grade-targets/types.ts";
import {
	buildGradeTargetSearchTargets,
	createGradeTargetSearch,
} from "./quickJumpSearch.ts";

describe("quick jump grade target search", () => {
	const targets: GradeTarget[] = [
		{
			id: "101",
			kind: "group",
			groupName: "Alpha Group",
			displayLabel: "Alpha Group",
			memberNames: ["Alice Martin", "Bob Lee"],
			searchKeys: ["alpha group", "alice martin", "bob lee"],
		},
		{
			id: "102",
			kind: "individual",
			studentName: "Charlie Brown",
			displayLabel: "Charlie Brown",
			memberNames: [],
			searchKeys: ["charlie brown"],
		},
	];

	it("finds a group by one of its members", () => {
		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(targets),
		);

		const results = search("alice");

		expect(results[0]?.targetId).toBe("101");
		expect(results[0]?.displayLabel).toBe("Alpha Group");
	});

	it("supports typo tolerance", () => {
		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(targets),
		);

		const results = search("alce");

		expect(results[0]?.targetId).toBe("101");
	});

	it("does not match by internal target id", () => {
		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(targets),
		);

		const results = search("101");

		expect(results).toHaveLength(0);
	});

	it("returns results for one-character queries", () => {
		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(targets),
		);

		const results = search("a");

		expect(results.length).toBeGreaterThan(0);
	});

	it("includes match reason in results", () => {
		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(targets),
		);

		const resultsForGroup = search("alpha");
		expect(resultsForGroup[0]?.matchReason).toContain("group");

		const resultsForMember = search("alice");
		expect(resultsForMember[0]?.matchReason).toContain("student");

		const resultsForIndividual = search("charlie");
		expect(resultsForIndividual[0]?.matchReason).toContain("matched student");
	});

	it("returns empty match reason for empty query", () => {
		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(targets),
		);

		const results = search("");
		expect(results[0]?.matchReason).toBe("");
	});

	it("preserves grade target order for empty query", () => {
		const unorderedTargets: GradeTarget[] = [
			{
				id: "3",
				kind: "individual",
				studentName: "Zoe Zebra",
				displayLabel: "Zoe Zebra",
				memberNames: [],
				searchKeys: ["zoe zebra"],
			},
			{
				id: "1",
				kind: "individual",
				studentName: "Alice Apple",
				displayLabel: "Alice Apple",
				memberNames: [],
				searchKeys: ["alice apple"],
			},
			{
				id: "2",
				kind: "individual",
				studentName: "Bob Banana",
				displayLabel: "Bob Banana",
				memberNames: [],
				searchKeys: ["bob banana"],
			},
		];

		const search = createGradeTargetSearch(
			buildGradeTargetSearchTargets(unorderedTargets),
		);

		const results = search("");
		expect(results.map((result) => result.targetId)).toEqual(["3", "1", "2"]);
	});

	it("keeps completion status in target rows", () => {
		const searchTargets = buildGradeTargetSearchTargets(targets, {
			"101": { completed: 1, total: 3 },
			"102": { completed: 4, total: 4 },
		});

		expect(searchTargets).toEqual([
			{
				targetId: "101",
				displayLabel: "Alpha Group",
				memberNames: ["Alice Martin", "Bob Lee"],
				progress: { completed: 1, total: 3 },
				isCompleted: false,
			},
			{
				targetId: "102",
				displayLabel: "Charlie Brown",
				memberNames: [],
				progress: { completed: 4, total: 4 },
				isCompleted: true,
			},
		]);
	});
});
