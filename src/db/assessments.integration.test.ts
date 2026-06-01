import { type Kysely } from "kysely";
import { describe, expect, test, vi } from "vitest";
import { buildTestId, createTestDb } from "#test/dbIntegration.ts";
import { createProject } from "#test/projects.ts";
import type { DB } from "./generated/db.ts";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ cacheTag: vi.fn(), updateTag: vi.fn() }));

async function loadAssessmentsWithDb(db: Kysely<DB>) {
	vi.resetModules();
	using _kyselyMock = vi.doMock("./kysely", () => ({ db }));

	const { loadAssessment } = await import("./assessments.ts");
	const { saveAssessment } = await import("./assessmentMutations.ts");

	return { loadAssessment, saveAssessment };
}

type AssessmentFixture = {
	projectId: string;
	projectRowId: number;
	questionId: string;
	studentId: string;
	studentRowId: number;
	submissionId: string;
	rubricIds: { boolean: string; ordinal: string; numerical: string };
};

type AssessmentFixtureOptions = {
	questionId?: string;
	rubricIds?: { boolean: string; ordinal: string; numerical: string };
};

async function createAssessmentFixture(
	db: Kysely<DB>,
	projectId: string,
	options?: AssessmentFixtureOptions,
): Promise<AssessmentFixture> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();

	const projectRowId = project.rowId;

	const questionId = options?.questionId ?? buildTestId("q");
	const studentId = buildTestId("student");
	const booleanRubricId =
		options?.rubricIds?.boolean ?? buildTestId("rubric-boolean");
	const ordinalRubricId =
		options?.rubricIds?.ordinal ?? buildTestId("rubric-ordinal");
	const numericalRubricId =
		options?.rubricIds?.numerical ?? buildTestId("rubric-numerical");

	await db
		.insertInto("student")
		.values({
			projectId: projectRowId,
			id: studentId,
			lastName: "Integration",
			firstName: "Test",
		})
		.execute();

	const studentRow = await db
		.selectFrom("student")
		.select(["rowId", "id"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", studentId)
		.executeTakeFirstOrThrow();

	const submission = await db
		.insertInto("submission")
		.values({
			projectId: projectRowId,
			type: "individual",
			studentId: studentRow.rowId,
		})
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("question")
		.values({
			projectId: projectRowId,
			id: questionId,
			label: "Integration question",
			position: 0,
		})
		.execute();

	const question = await db
		.selectFrom("question")
		.select(["id", "rowId"])
		.where("projectId", "=", projectRowId)
		.where("id", "=", questionId)
		.executeTakeFirstOrThrow();

	const insertedRubrics = await db
		.insertInto("rubric")
		.values([
			{
				id: booleanRubricId,
				projectId: projectRowId,
				questionId: question.rowId,
				type: "boolean",
				position: 0,
				label: "Boolean rubric",
			},
			{
				id: ordinalRubricId,
				projectId: projectRowId,
				questionId: question.rowId,
				type: "ordinal",
				position: 1,
				label: "Ordinal rubric",
			},
			{
				id: numericalRubricId,
				projectId: projectRowId,
				questionId: question.rowId,
				type: "numerical",
				position: 2,
				label: "Numerical rubric",
			},
		])
		.returning(["id", "rowId"])
		.execute();

	const rubricRowIdById = new Map(
		insertedRubrics.map((rubric) => [rubric.id, rubric.rowId]),
	);

	const booleanRubricRowId = rubricRowIdById.get(booleanRubricId);
	const ordinalRubricRowId = rubricRowIdById.get(ordinalRubricId);
	const numericalRubricRowId = rubricRowIdById.get(numericalRubricId);

	if (
		booleanRubricRowId == null ||
		ordinalRubricRowId == null ||
		numericalRubricRowId == null
	) {
		throw new Error("Expected inserted rubrics to be returned with row ids.");
	}

	await db
		.insertInto("booleanRubric")
		.values({ rubricId: booleanRubricRowId, marks: 2 })
		.execute();

	const ordinalRubric = await db
		.insertInto("ordinalRubric")
		.values({ rubricId: ordinalRubricRowId })
		.returning("id")
		.executeTakeFirstOrThrow();

	await db
		.insertInto("ordinalRubricValue")
		.values([
			{ ordinalRubricId: ordinalRubric.id, label: "A", marks: 3 },
			{ ordinalRubricId: ordinalRubric.id, label: "B", marks: 1 },
		])
		.execute();

	await db
		.insertInto("numericalRubric")
		.values({
			rubricId: numericalRubricRowId,
			minScore: 0,
			maxScore: 10,
			minMarks: 0,
			maxMarks: 5,
		})
		.execute();

	const fixture = {
		projectId,
		projectRowId,
		questionId,
		studentId,
		studentRowId: studentRow.rowId,
		submissionId: String(submission.id),
		rubricIds: {
			boolean: booleanRubricId,
			ordinal: ordinalRubricId,
			numerical: numericalRubricId,
		},
	};

	return fixture;
}

async function cleanupFixture(
	db: Kysely<DB>,
	fixture: AssessmentFixture,
): Promise<void> {
	await db
		.deleteFrom("submission")
		.where("id", "=", Number(fixture.submissionId))
		.execute();

	await db
		.deleteFrom("question")
		.where("projectId", "=", fixture.projectRowId)
		.where("id", "=", fixture.questionId)
		.execute();

	await db
		.deleteFrom("student")
		.where("rowId", "=", fixture.studentRowId)
		.execute();
}

describe("assessment DB integration", () => {
	// Next caching is not active under vitest, so assert the observable seam: that
	// loadAssessment declares "assessments:all" alongside its granular tag. Bulk
	// imports only bust the coarse tag, so without this declaration the per-question
	// grading view would serve stale data after an assessment import.
	test("loadAssessment declares the assessments:all fallback tag", async () => {
		await using db = await createTestDb();
		const { loadAssessment } = await loadAssessmentsWithDb(db);
		const { cacheTag } = await import("next/cache");
		await using project = await createProject(
			db,
			"Assessment Cache Tag Project",
		);
		const fixture = await createAssessmentFixture(db, project.id);

		try {
			await loadAssessment(fixture.submissionId, fixture.questionId);

			const declaredTags = vi
				.mocked(cacheTag)
				.mock.calls.map((call) => call[0]);

			expect(declaredTags).toContain("assessments:all");
			expect(declaredTags).toContain(
				`assessments:${fixture.submissionId}:${fixture.questionId}`,
			);
		} finally {
			await cleanupFixture(db, fixture);
		}
	});

	test("round-trips boolean, ordinal and numerical assessments", async () => {
		await using db = await createTestDb();
		const { loadAssessment, saveAssessment } = await loadAssessmentsWithDb(db);
		await using project = await createProject(
			db,
			"Assessment Integration Project",
		);
		const fixture = await createAssessmentFixture(db, project.id);

		try {
			const results = await Promise.all([
				saveAssessment({
					submissionId: fixture.submissionId,
					questionId: fixture.questionId,
					rubric: {
						rubricId: fixture.rubricIds.boolean,
						type: "boolean",
						passed: true,
					},
				}),
				saveAssessment({
					submissionId: fixture.submissionId,
					questionId: fixture.questionId,
					rubric: {
						rubricId: fixture.rubricIds.ordinal,
						type: "ordinal",
						selectedLabel: "B",
					},
				}),
				saveAssessment({
					submissionId: fixture.submissionId,
					questionId: fixture.questionId,
					rubric: {
						rubricId: fixture.rubricIds.numerical,
						type: "numerical",
						score: 7.5,
					},
				}),
			]);

			expect(results).toEqual([
				{ success: true },
				{ success: true },
				{ success: true },
			]);

			const loaded = await loadAssessment(
				fixture.submissionId,
				fixture.questionId,
			);

			const byRubricId = new Map(
				loaded.map((value) => [value.rubricId, value]),
			);

			expect(byRubricId.get(fixture.rubricIds.boolean)).toEqual({
				rubricId: fixture.rubricIds.boolean,
				type: "boolean",
				passed: true,
			});

			expect(byRubricId.get(fixture.rubricIds.ordinal)).toEqual({
				rubricId: fixture.rubricIds.ordinal,
				type: "ordinal",
				selectedLabel: "B",
			});

			expect(byRubricId.get(fixture.rubricIds.numerical)).toEqual({
				rubricId: fixture.rubricIds.numerical,
				type: "numerical",
				score: 7.5,
			});
		} finally {
			await cleanupFixture(db, fixture);
		}
	});

	test("returns a validation error for invalid ordinal label", async () => {
		await using db = await createTestDb();
		const { saveAssessment } = await loadAssessmentsWithDb(db);
		await using project = await createProject(
			db,
			"Assessment Integration Project",
		);
		const fixture = await createAssessmentFixture(db, project.id);

		try {
			const result = await saveAssessment({
				submissionId: fixture.submissionId,
				questionId: fixture.questionId,
				rubric: {
					rubricId: fixture.rubricIds.ordinal,
					type: "ordinal",
					selectedLabel: "Z",
				},
			});

			expect(result).toEqual({
				success: false,
				error:
					"That option is no longer available. Reload and choose another option.",
			});
		} finally {
			await cleanupFixture(db, fixture);
		}
	});

	test("returns a validation error for out-of-range numerical score", async () => {
		await using db = await createTestDb();
		const { saveAssessment } = await loadAssessmentsWithDb(db);
		await using project = await createProject(
			db,
			"Assessment Integration Project",
		);
		const fixture = await createAssessmentFixture(db, project.id);

		try {
			const result = await saveAssessment({
				submissionId: fixture.submissionId,
				questionId: fixture.questionId,
				rubric: {
					rubricId: fixture.rubricIds.numerical,
					type: "numerical",
					score: 11,
				},
			});

			expect(result).toEqual({
				success: false,
				error: "Enter a score of at most 10.",
			});
		} finally {
			await cleanupFixture(db, fixture);
		}
	});

	test("saves assessments in the correct project when question and rubric ids collide", async () => {
		await using db = await createTestDb();
		const { loadAssessment, saveAssessment } = await loadAssessmentsWithDb(db);
		await using projectA = await createProject(
			db,
			"Assessment Collision Project A",
		);
		await using projectB = await createProject(
			db,
			"Assessment Collision Project B",
		);
		const sharedQuestionId = buildTestId("shared-question");
		const sharedRubricIds = {
			boolean: buildTestId("shared-rubric-boolean"),
			ordinal: buildTestId("shared-rubric-ordinal"),
			numerical: buildTestId("shared-rubric-numerical"),
		};

		let fixtureA: AssessmentFixture | null = null;
		let fixtureB: AssessmentFixture | null = null;

		try {
			fixtureA = await createAssessmentFixture(db, projectA.id, {
				questionId: sharedQuestionId,
				rubricIds: sharedRubricIds,
			});
			fixtureB = await createAssessmentFixture(db, projectB.id, {
				questionId: sharedQuestionId,
				rubricIds: sharedRubricIds,
			});

			const result = await saveAssessment({
				submissionId: fixtureB.submissionId,
				questionId: fixtureB.questionId,
				rubric: {
					rubricId: fixtureB.rubricIds.boolean,
					type: "boolean",
					passed: true,
				},
			});

			expect(result).toEqual({ success: true });

			const projectBAssessment = await loadAssessment(
				fixtureB.submissionId,
				fixtureB.questionId,
			);
			expect(projectBAssessment).toEqual([
				{ rubricId: fixtureB.rubricIds.boolean, type: "boolean", passed: true },
			]);

			const projectAAssessment = await loadAssessment(
				fixtureA.submissionId,
				fixtureA.questionId,
			);
			expect(projectAAssessment).toEqual([]);
		} finally {
			if (fixtureB != null) {
				await cleanupFixture(db, fixtureB);
			}

			if (fixtureA != null) {
				await cleanupFixture(db, fixtureA);
			}
		}
	});

	test("rejects cross-project submission and question combinations", async () => {
		await using db = await createTestDb();
		const { saveAssessment } = await loadAssessmentsWithDb(db);
		await using projectA = await createProject(
			db,
			"Assessment Isolation Project A",
		);
		await using projectB = await createProject(
			db,
			"Assessment Isolation Project B",
		);

		let fixtureA: AssessmentFixture | null = null;
		let fixtureB: AssessmentFixture | null = null;

		try {
			fixtureA = await createAssessmentFixture(db, projectA.id);
			fixtureB = await createAssessmentFixture(db, projectB.id);

			const result = await saveAssessment({
				submissionId: fixtureA.submissionId,
				questionId: fixtureB.questionId,
				rubric: {
					rubricId: fixtureB.rubricIds.boolean,
					type: "boolean",
					passed: true,
				},
			});

			expect(result).toEqual({
				success: false,
				error:
					"We couldn't match this grade to the selected student work. Reload and try again. If this keeps happening, report this issue.",
			});
		} finally {
			if (fixtureB != null) {
				await cleanupFixture(db, fixtureB);
			}

			if (fixtureA != null) {
				await cleanupFixture(db, fixtureA);
			}
		}
	});
});
