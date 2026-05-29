import { describe, expect, it } from "vitest";
import type { Submission } from "@/db/types";
import {
	buildSubmissionSearchTargets,
	createSubmissionSearch,
} from "./quickJumpSearch";

describe("quick jump submission search", () => {
	const submissions: Submission[] = [
		{
			id: "101",
			type: "team",
			teamName: "Alpha Team",
			displayLabel: "Alpha Team",
			memberNames: ["Alice Martin", "Bob Lee"],
			searchKeys: ["alpha team", "alice martin", "bob lee"],
		},
		{
			id: "102",
			type: "individual",
			studentName: "Charlie Brown",
			displayLabel: "Charlie Brown",
			memberNames: [],
			searchKeys: ["charlie brown"],
		},
	];

	it("finds a team by one of its members", () => {
		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(submissions),
		);

		const results = search("alice");

		expect(results[0]?.submissionId).toBe("101");
		expect(results[0]?.displayLabel).toBe("Alpha Team");
	});

	it("supports typo tolerance", () => {
		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(submissions),
		);

		const results = search("alce");

		expect(results[0]?.submissionId).toBe("101");
	});

	it("does not match by internal submission id", () => {
		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(submissions),
		);

		const results = search("101");

		expect(results).toHaveLength(0);
	});

	it("returns results for one-character queries", () => {
		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(submissions),
		);

		const results = search("a");

		expect(results.length).toBeGreaterThan(0);
	});

	it("includes match reason in results", () => {
		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(submissions),
		);

		const resultsForTeam = search("alpha");
		expect(resultsForTeam[0]?.matchReason).toContain("team");

		const resultsForMember = search("alice");
		expect(resultsForMember[0]?.matchReason).toContain("student");

		const resultsForIndividual = search("charlie");
		expect(resultsForIndividual[0]?.matchReason).toContain("matched student");
	});

	it("returns empty match reason for empty query", () => {
		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(submissions),
		);

		const results = search("");
		expect(results[0]?.matchReason).toBe("");
	});

	it("preserves submission order for empty query", () => {
		const unorderedSubmissions: Submission[] = [
			{
				id: "3",
				type: "individual",
				studentName: "Zoe Zebra",
				displayLabel: "Zoe Zebra",
				memberNames: [],
				searchKeys: ["zoe zebra"],
			},
			{
				id: "1",
				type: "individual",
				studentName: "Alice Apple",
				displayLabel: "Alice Apple",
				memberNames: [],
				searchKeys: ["alice apple"],
			},
			{
				id: "2",
				type: "individual",
				studentName: "Bob Banana",
				displayLabel: "Bob Banana",
				memberNames: [],
				searchKeys: ["bob banana"],
			},
		];

		const search = createSubmissionSearch(
			buildSubmissionSearchTargets(unorderedSubmissions),
		);

		const results = search("");
		expect(results.map((result) => result.submissionId)).toEqual([
			"3",
			"1",
			"2",
		]);
	});

	it("keeps completion status in target rows", () => {
		const targets = buildSubmissionSearchTargets(submissions, {
			"101": { completed: 1, total: 3 },
			"102": { completed: 4, total: 4 },
		});

		expect(targets).toEqual([
			{
				submissionId: "101",
				displayLabel: "Alpha Team",
				memberNames: ["Alice Martin", "Bob Lee"],
				progress: { completed: 1, total: 3 },
				isCompleted: false,
			},
			{
				submissionId: "102",
				displayLabel: "Charlie Brown",
				memberNames: [],
				progress: { completed: 4, total: 4 },
				isCompleted: true,
			},
		]);
	});
});
