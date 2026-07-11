import { describe, expect, it } from "vitest";
import {
	groupStudentsIntoGradeTargets,
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

describe("groupStudentsIntoGradeTargets", () => {
	it("groups group students and creates individual grade targets", () => {
		const students = [
			{ lastName: "Smith", firstName: "Alice", id: "s1" },
			{ lastName: "Jones", firstName: "Bob", id: "s2", group: "Group A" },
			{ lastName: "Ray", firstName: "Cora", id: "s3", group: "Group A" },
		];

		const targets = groupStudentsIntoGradeTargets(students);

		expect(targets).toHaveLength(2);

		const groupTarget = targets.find((target) => target.kind === "group");
		expect(groupTarget).toBeDefined();
		expect(groupTarget?.students).toHaveLength(2);

		const individualTarget = targets.find(
			(target) => target.kind === "individual",
		);
		expect(individualTarget).toBeDefined();
		expect(individualTarget?.students[0]?.id).toBe("s1");
	});

	it("generates unique grade target ids when group slugs collide", () => {
		const students = [
			{ lastName: "One", firstName: "Alpha", id: "s1", group: "Group A" },
			{ lastName: "Two", firstName: "Beta", id: "s2", group: "Group-A" },
		];

		const targets = groupStudentsIntoGradeTargets(students);
		const groupIds = targets
			.filter((target) => target.kind === "group")
			.map((target) => target.id)
			.sort((a, b) => a.localeCompare(b));

		expect(groupIds).toEqual(["group-group-a", "group-group-a-2"]);
	});
});
