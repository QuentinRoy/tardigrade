import { describe, expect, it } from "vitest";
import {
	groupStudentsIntoSubmissions,
	parseStudentsCsv,
} from "./parseStudents.ts";

describe("parseStudentsCsv", () => {
	it("parses required columns and optional group", () => {
		const students = parseStudentsCsv(`last_name,first_name,id,group
Smith,Alice,s1,
Jones,Bob,s2,Group A`);

		expect(students).toEqual([
			{ lastName: "Smith", firstName: "Alice", id: "s1" },
			{ lastName: "Jones", firstName: "Bob", id: "s2", group: "Group A" },
		]);
	});
});

describe("groupStudentsIntoSubmissions", () => {
	it("groups group students and creates individual submissions", () => {
		const students = [
			{ lastName: "Smith", firstName: "Alice", id: "s1" },
			{ lastName: "Jones", firstName: "Bob", id: "s2", group: "Group A" },
			{ lastName: "Ray", firstName: "Cora", id: "s3", group: "Group A" },
		];

		const submissions = groupStudentsIntoSubmissions(students);

		expect(submissions).toHaveLength(2);

		const groupSubmission = submissions.find(
			(submission) => submission.type === "group",
		);
		expect(groupSubmission).toBeDefined();
		expect(groupSubmission?.students).toHaveLength(2);

		const individualSubmission = submissions.find(
			(submission) => submission.type === "individual",
		);
		expect(individualSubmission).toBeDefined();
		expect(individualSubmission?.students[0]?.id).toBe("s1");
	});

	it("generates unique submission ids when group slugs collide", () => {
		const students = [
			{ lastName: "One", firstName: "Alpha", id: "s1", group: "Group A" },
			{ lastName: "Two", firstName: "Beta", id: "s2", group: "Group-A" },
		];

		const submissions = groupStudentsIntoSubmissions(students);
		const groupIds = submissions
			.filter((submission) => submission.type === "group")
			.map((submission) => submission.id)
			.sort((a, b) => a.localeCompare(b));

		expect(groupIds).toEqual(["group-group-a", "group-group-a-2"]);
	});
});
