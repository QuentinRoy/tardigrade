import { describe, expect, it } from "vitest";
import { parseRubricsYaml } from "./parseRubrics.ts";

describe("parseRubricsYaml", () => {
	it("parses valid rubrics YAML", () => {
		const rubrics = parseRubricsYaml(`rubrics:
  - id: q1
    label: Rubric 1
    criteria:
      - id: r1
        kind: check
        marks: 2`);

		expect(rubrics).toHaveLength(1);
		expect(rubrics[0]?.id).toBe("q1");
		expect(rubrics[0]?.criteria[0]?.id).toBe("r1");
	});

	it("parses reversed numerical criteria", () => {
		const rubrics = parseRubricsYaml(`rubrics:
  - id: q1
    criteria:
      - id: r1
        kind: number
        minValue: 0
        maxValue: 10
        minMarks: 0
        maxMarks: 5
        reversed: true`);

		expect(rubrics[0]?.criteria[0]).toMatchObject({
			id: "r1",
			kind: "number",
			reversed: true,
		});
	});

	// The number criterion's numeric-payload field was renamed from `minScore`/
	// `maxScore` to `minValue`/`maxValue`. A file still using the old field
	// names must be rejected loudly, with an actionable message naming the
	// criterion and the stale fields, rather than Zod's terse default or a
	// silent import of defaults.
	it("rejects a number criterion still using the old `minScore`/`maxScore` fields", () => {
		expect(() =>
			parseRubricsYaml(`rubrics:
  - id: q1
    criteria:
      - id: r1
        kind: number
        minScore: 0
        maxScore: 10`),
		).toThrow(
			/unexpected fields.*minScore.*maxScore.*criterion.*r1.*import again/is,
		);
	});

	// The unrecognized-key message is defined once on the shared base criterion
	// schema, so it must reach every criterion kind, not just Number.
	it("rejects a check criterion with an unrecognized field", () => {
		expect(() =>
			parseRubricsYaml(`rubrics:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 2
        passMarks: 2`),
		).toThrow(/unexpected field.*passMarks.*criterion.*r1.*import again/is);
	});

	it("parses criterion description", () => {
		const rubrics = parseRubricsYaml(`rubrics:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 2
        description: A helpful description`);

		expect(rubrics[0]?.criteria[0]?.description).toBe("A helpful description");
	});

	it("parses boolean falseMarks", () => {
		const rubrics = parseRubricsYaml(`rubrics:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 2
        falseMarks: -1`);

		expect(rubrics[0]?.criteria[0]).toMatchObject({
			id: "r1",
			kind: "check",
			marks: 2,
			falseMarks: -1,
		});
	});

	it("throws when rubric ids are duplicated", () => {
		expect(() =>
			parseRubricsYaml(`rubrics:
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
		).toThrow("Rubric ids must be unique");
	});

	// The top-level key was renamed from `questions:` to `rubrics:`. A file still
	// using the old key must be rejected loudly, naming the stale key, rather
	// than silently importing nothing.
	it("rejects the old top-level `questions:` key by name", () => {
		expect(() =>
			parseRubricsYaml(`questions:
  - id: q1
    criteria:
      - id: r1
        kind: check
        marks: 1`),
		).toThrow(/unexpected top-level entry.*questions.*rubrics/is);
	});

	it("names an unknown top-level key and points to `rubrics:`", () => {
		expect(() =>
			parseRubricsYaml(`rubric:
  - id: r1
    criteria:
      - id: c1
        kind: check
        marks: 1`),
		).toThrow(/unexpected top-level entry.*rubric.*rubrics/is);
	});
});
