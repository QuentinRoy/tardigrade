import { describe, expect, it } from "vitest";
import { hasEnoughOptionsMarks } from "./optionsMarks.ts";

describe("hasEnoughOptionsMarks", () => {
	it("accepts two or more mark entries", () => {
		expect(hasEnoughOptionsMarks({ Pass: 1, Fail: 0 })).toBe(true);
		expect(hasEnoughOptionsMarks({ Good: 2, Fair: 1, Poor: 0 })).toBe(true);
	});

	it("rejects fewer than two mark entries", () => {
		expect(hasEnoughOptionsMarks({ Pass: 1 })).toBe(false);
		expect(hasEnoughOptionsMarks({})).toBe(false);
	});
});
