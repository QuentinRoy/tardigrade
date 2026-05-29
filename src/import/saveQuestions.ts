import "server-only";
import { db } from "../db/kysely";
import type { ImportedQuestions } from "./types";

export async function saveQuestions(
	questions: ImportedQuestions,
	projectId: string,
): Promise<{ questionCount: number; rubricCount: number }> {
	const questionsById = questions.map((question, position) => ({
		id: question.id,
		label: question.label ?? null,
		position,
	}));

	const rubricSources = questions.flatMap((question) =>
		question.rubrics.map((rubric, position) => ({
			id: rubric.id,
			questionId: question.id,
			position,
			description: rubric.description ?? null,
			label: rubric.label ?? null,
			type: rubric.type,
		})),
	);

	const booleanRubricSources = questions.flatMap((question) =>
		question.rubrics.flatMap((rubric) =>
			rubric.type === "boolean"
				? [
						{
							rubricId: rubric.id,
							marks: rubric.marks,
							falseMarks: rubric.falseMarks ?? 0,
						},
					]
				: [],
		),
	);

	const numericalRubricSources = questions.flatMap((question) =>
		question.rubrics.flatMap((rubric) =>
			rubric.type === "numerical"
				? [
						{
							rubricId: rubric.id,
							minScore: rubric.minScore,
							maxScore: rubric.maxScore,
							minMarks: rubric.minMarks,
							maxMarks: rubric.maxMarks,
							reversed: rubric.reversed,
						},
					]
				: [],
		),
	);

	const ordinalRubricSources = questions.flatMap((question) =>
		question.rubrics.flatMap((rubric) =>
			rubric.type === "ordinal"
				? [{ rubricId: rubric.id, marks: rubric.marks }]
				: [],
		),
	);

	const questionIds = questionsById.map((question) => question.id);
	const rubricIds = rubricSources.map((rubric) => rubric.id);
	const rubricTypeById = new Map(
		rubricSources.map((rubric) => [rubric.id, rubric.type]),
	);

	return db.transaction().execute(async (tx) => {
		const projectRow = await tx
			.selectFrom("project")
			.select("rowId")
			.where("id", "=", projectId)
			.executeTakeFirstOrThrow();
		const projectRowId = projectRow.rowId;

		const existingRubrics =
			rubricIds.length === 0
				? []
				: await tx
						.selectFrom("rubric")
						.select(["id", "type"])
						.where("rubric.projectId", "=", projectRowId)
						.where("id", "in", rubricIds)
						.execute();

		const rubricsToRecreate = existingRubrics.flatMap((rubric) => {
			const nextType = rubricTypeById.get(rubric.id);

			if (nextType == null || nextType === rubric.type) {
				return [];
			}

			return [rubric.id];
		});

		if (rubricsToRecreate.length > 0) {
			await tx
				.deleteFrom("rubric")
				.where("projectId", "=", projectRowId)
				.where("id", "in", rubricsToRecreate)
				.execute();
		}

		if (questionsById.length > 0) {
			await tx
				.insertInto("question")
				.values(
					questionsById.map((question) => ({
						...question,
						projectId: projectRowId,
					})),
				)
				.onConflict((conflict) =>
					conflict
						.columns(["projectId", "id"])
						.doUpdateSet((expressionBuilder) => ({
							label: expressionBuilder.ref("excluded.label"),
							position: expressionBuilder.ref("excluded.position"),
						})),
				)
				.execute();
		}

		const existingQuestions =
			questionIds.length === 0
				? []
				: await tx
						.selectFrom("question")
						.select(["id", "rowId"])
						.where("projectId", "=", projectRowId)
						.where("id", "in", questionIds)
						.execute();

		const questionRowIdByBusinessId = new Map(
			existingQuestions.map((question) => [question.id, question.rowId]),
		);

		const rubricRows = rubricSources.map((rubric) => {
			const questionRowId = questionRowIdByBusinessId.get(rubric.questionId);

			if (questionRowId == null) {
				throw new Error(
					`Imported rubric '${rubric.id}' references unknown question '${rubric.questionId}'.`,
				);
			}

			return {
				id: rubric.id,
				questionId: questionRowId,
				position: rubric.position,
				description: rubric.description,
				label: rubric.label,
				projectId: projectRowId,
				type: rubric.type,
			};
		});

		if (rubricRows.length > 0) {
			await tx
				.insertInto("rubric")
				.values(rubricRows)
				.onConflict((conflict) =>
					conflict
						.columns(["projectId", "id"])
						.doUpdateSet((expressionBuilder) => ({
							questionId: expressionBuilder.ref("excluded.questionId"),
							position: expressionBuilder.ref("excluded.position"),
							description: expressionBuilder.ref("excluded.description"),
							label: expressionBuilder.ref("excluded.label"),
							type: expressionBuilder.ref("excluded.type"),
						})),
				)
				.execute();
		}

		const existingPersistedRubrics =
			rubricIds.length === 0
				? []
				: await tx
						.selectFrom("rubric")
						.select(["id", "rowId"])
						.where("projectId", "=", projectRowId)
						.where("id", "in", rubricIds)
						.execute();

		const rubricRowIdByBusinessId = new Map(
			existingPersistedRubrics.map((rubric) => [rubric.id, rubric.rowId]),
		);

		const booleanRubricRows = booleanRubricSources.map((rubric) => {
			const rubricRowId = rubricRowIdByBusinessId.get(rubric.rubricId);

			if (rubricRowId == null) {
				throw new Error(
					`Imported boolean rubric '${rubric.rubricId}' could not be resolved.`,
				);
			}

			return {
				rubricId: rubricRowId,
				marks: rubric.marks,
				falseMarks: rubric.falseMarks,
			};
		});

		if (booleanRubricRows.length > 0) {
			await tx
				.insertInto("booleanRubric")
				.values(booleanRubricRows)
				.onConflict((conflict) =>
					conflict
						.column("rubricId")
						.doUpdateSet((expressionBuilder) => ({
							marks: expressionBuilder.ref("excluded.marks"),
							falseMarks: expressionBuilder.ref("excluded.falseMarks"),
						})),
				)
				.execute();
		}

		const numericalRubricRows = numericalRubricSources.map((rubric) => {
			const rubricRowId = rubricRowIdByBusinessId.get(rubric.rubricId);

			if (rubricRowId == null) {
				throw new Error(
					`Imported numerical rubric '${rubric.rubricId}' could not be resolved.`,
				);
			}

			return {
				rubricId: rubricRowId,
				minScore: rubric.minScore,
				maxScore: rubric.maxScore,
				minMarks: rubric.minMarks,
				maxMarks: rubric.maxMarks,
				reversed: rubric.reversed,
			};
		});

		if (numericalRubricRows.length > 0) {
			await tx
				.insertInto("numericalRubric")
				.values(numericalRubricRows)
				.onConflict((conflict) =>
					conflict
						.column("rubricId")
						.doUpdateSet((expressionBuilder) => ({
							minScore: expressionBuilder.ref("excluded.minScore"),
							maxScore: expressionBuilder.ref("excluded.maxScore"),
							minMarks: expressionBuilder.ref("excluded.minMarks"),
							maxMarks: expressionBuilder.ref("excluded.maxMarks"),
							reversed: expressionBuilder.ref("excluded.reversed"),
						})),
				)
				.execute();
		}

		if (ordinalRubricSources.length > 0) {
			const ordinalRubricRows = ordinalRubricSources.map((source) => {
				const rubricRowId = rubricRowIdByBusinessId.get(source.rubricId);

				if (rubricRowId == null) {
					throw new Error(
						`Imported ordinal rubric '${source.rubricId}' could not be resolved.`,
					);
				}

				return { rubricId: rubricRowId };
			});

			await tx
				.insertInto("ordinalRubric")
				.values(ordinalRubricRows)
				.onConflict((conflict) => conflict.column("rubricId").doNothing())
				.execute();

			const ordinalRubricIdsToFetch = ordinalRubricRows.map(
				(source) => source.rubricId,
			);

			const upsertedOrdinalRubrics = await tx
				.selectFrom("ordinalRubric")
				.select(["id", "rubricId"])
				.where("rubricId", "in", ordinalRubricIdsToFetch)
				.execute();

			const ordinalRubricIdByRubricId = new Map(
				upsertedOrdinalRubrics.map((row) => [row.rubricId, row.id]),
			);

			const ordinalRubricIds = upsertedOrdinalRubrics.map((row) => row.id);

			const validPairKeys = new Set(
				ordinalRubricSources.flatMap((source) => {
					const rubricRowId = rubricRowIdByBusinessId.get(source.rubricId);
					if (rubricRowId == null) return [];

					const ordinalRubricId = ordinalRubricIdByRubricId.get(rubricRowId);
					if (ordinalRubricId == null) return [];

					return Object.keys(source.marks).map(
						(label) => `${ordinalRubricId}::${label}`,
					);
				}),
			);

			const existingOrdinalValues =
				ordinalRubricIds.length === 0
					? []
					: await tx
							.selectFrom("ordinalRubricValue")
							.select(["id", "ordinalRubricId", "label"])
							.where("ordinalRubricId", "in", ordinalRubricIds)
							.execute();

			const staleOrdinalValueIds = existingOrdinalValues
				.filter(
					(value) =>
						!validPairKeys.has(`${value.ordinalRubricId}::${value.label}`),
				)
				.map((value) => value.id);

			if (staleOrdinalValueIds.length > 0) {
				await tx
					.deleteFrom("ordinalRubricValue")
					.where("id", "in", staleOrdinalValueIds)
					.execute();
			}

			const ordinalValueRows = ordinalRubricSources.flatMap((source) => {
				const rubricRowId = rubricRowIdByBusinessId.get(source.rubricId);
				if (rubricRowId == null) return [];

				const ordinalRubricId = ordinalRubricIdByRubricId.get(rubricRowId);
				if (ordinalRubricId == null) return [];

				return Object.entries(source.marks).map(([label, marks]) => ({
					ordinalRubricId,
					label,
					marks,
				}));
			});

			if (ordinalValueRows.length > 0) {
				await tx
					.insertInto("ordinalRubricValue")
					.values(ordinalValueRows)
					.onConflict((conflict) =>
						conflict
							.columns(["ordinalRubricId", "label"])
							.doUpdateSet((expressionBuilder) => ({
								marks: expressionBuilder.ref("excluded.marks"),
							})),
					)
					.execute();
			}
		}

		return { questionCount: questionIds.length, rubricCount: rubricIds.length };
	});
}
