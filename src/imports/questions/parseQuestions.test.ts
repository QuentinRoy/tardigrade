import { describe, expect, it } from "vitest";
import { parseQuestionsYaml } from "./parseQuestions.ts";

describe("parseQuestionsYaml", () => {
	it("parses valid questions YAML", () => {
		const questions = parseQuestionsYaml(`questions:
  - id: q1
    label: Question 1
    criteria:
      - id: r1
        kind: check
        marks: 2`);

		expect(questions).toHaveLength(1);
		expect(questions[0]?.id).toBe("q1");
		expect(questions[0]?.criteria[0]?.id).toBe("r1");
	});

	it("parses reversed numerical criteria", () => {
		const questions = parseQuestionsYaml(`questions:
  - id: q1
    criteria:
      - id: r1
        kind: number
        minScore: 0
        maxScore: 10
        minMarks: 0
        maxMarks: 5
        reversed: true`);

		expect(questions[0]?.criteria[0]).toMatchObject({
			id: "r1",
			kind: "number",
			reversed: true,
		});
	});

	it("parses criterion description", () => {
		const questions = parseQuestionsYaml(`questions:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 2
        description: A helpful description`);

		expect(questions[0]?.criteria[0]?.description).toBe(
			"A helpful description",
		);
	});

	it("parses boolean falseMarks", () => {
		const questions = parseQuestionsYaml(`questions:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 2
        falseMarks: -1`);

		expect(questions[0]?.criteria[0]).toMatchObject({
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: -1,
		});
	});

	it("throws when question ids are duplicated", () => {
		expect(() =>
			parseQuestionsYaml(`questions:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 1
  - id: q1
    criteria:
      - id: r2
        kind: check
        marks: 1`),
		).toThrow("Question ids must be unique");
	});
});
