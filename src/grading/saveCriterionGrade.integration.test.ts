import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import { createTestDb } from "#test/dbIntegration.ts";
import { createGradeFixture } from "#test/grades.ts";
import { createProject } from "#test/projects.ts";
import { saveCriterionGrade } from "./saveCriterionGrade.ts";

vi.mock("next/cache", () => ({
	cacheTag: vi.fn(),
	revalidateTag: vi.fn(),
	updateTag: vi.fn(),
}));

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn() } }));

vi.mock("#utils/logger.ts", () => ({ createLogger: () => mockLogger }));

beforeEach(() => {
	vi.clearAllMocks();
});

test("saveCriterionGrade returns a generic shaped error and logs once when the mutation throws", async () => {
	const db = await createTestDb();
	const fixture = await (async () => {
		await using project = await createProject(db, "Save Grade Failure Project");
		return await createGradeFixture(db, project.id);
	})();

	try {
		// Destroying the connection pool forces db.transaction().execute(...) to
		// throw an infra error, simulating an unexpected/operational failure
		// rather than a domain validation failure.
		await db.destroy();

		const result = await saveCriterionGrade(
			{
				projectId: fixture.projectId,
				targetId: fixture.gradeTargetId,
				rubricId: fixture.rubricId,
				grade: {
					criterionId: fixture.criterionIds.boolean,
					kind: "check",
					passed: true,
				},
			},
			{ db },
		);

		expect(result.success).toBe(false);
		if (result.success) {
			throw new Error("Expected the save to fail");
		}
		expect(result.error).not.toMatch(/connection|pool|ECONNRESET/i);
		expect(result.error).toMatch(/try again|reload/i);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
		expect(revalidateTag).not.toHaveBeenCalled();
		expect(updateTag).not.toHaveBeenCalled();
	} finally {
		// The pool is already destroyed above; only stop the container/cleanup.
		await db[Symbol.asyncDispose]();
	}
});
