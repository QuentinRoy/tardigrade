import "server-only";
import { cacheLife } from "next/cache";
import { CACHE_TAGS, cacheTags } from "./cacheTags.ts";
import { db } from "./kysely.ts";
import type { Grid, Question, Rubric, RubricType } from "./types.ts";

export function toNumber(value: string | number): number {
	if (typeof value === "number") return value;
	return parseFloat(value);
}

export function toRubric(data: {
	id: string;
	type: RubricType;
	description: string | null;
	label: string | null;
	booleanRubric: { marks: number; falseMarks: number } | null;
	ordinalRubric: { marks: { label: string; marks: number }[] } | null;
	numericalRubric: {
		minScore: number;
		maxScore: number;
		minMarks: number;
		maxMarks: number;
		reversed: boolean;
	} | null;
}): Rubric {
	if (data.type === "ordinal" && data.ordinalRubric) {
		const marks = Object.fromEntries(
			data.ordinalRubric.marks.map((item) => [
				item.label,
				toNumber(item.marks),
			]),
		);
		return {
			id: data.id,
			description: data.description ?? undefined,
			label: data.label ?? undefined,
			type: "ordinal",
			marks,
		};
	}

	if (data.type === "numerical" && data.numericalRubric) {
		return {
			id: data.id,
			description: data.description ?? undefined,
			label: data.label ?? undefined,
			type: "numerical",
			minScore: toNumber(data.numericalRubric.minScore),
			maxScore: toNumber(data.numericalRubric.maxScore),
			minMarks: toNumber(data.numericalRubric.minMarks),
			maxMarks: toNumber(data.numericalRubric.maxMarks),
			reversed: data.numericalRubric.reversed,
		};
	}

	return {
		id: data.id,
		description: data.description ?? undefined,
		label: data.label ?? undefined,
		type: "boolean",
		marks: data.booleanRubric ? toNumber(data.booleanRubric.marks) : 0,
		falseMarks: data.booleanRubric
			? toNumber(data.booleanRubric.falseMarks)
			: 0,
	};
}

export type QuestionRow = {
	id: string;
	label: string | null;
	rubrics: {
		id: string;
		type: RubricType;
		description: string | null;
		label: string | null;
		booleanRubric: { marks: number; falseMarks: number } | null;
		ordinalRubric: { marks: { label: string; marks: number }[] } | null;
		numericalRubric: {
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
		} | null;
	}[];
};

export async function resolveProjectRowId(projectId: string): Promise<number> {
	const project = await db
		.selectFrom("project")
		.select("rowId")
		.where("id", "=", projectId)
		.executeTakeFirstOrThrow();

	return project.rowId;
}

export async function loadQuestionsFromDb(
	projectId: string,
): Promise<QuestionRow[]> {
	"use cache";
	cacheTags(CACHE_TAGS.questions);
	cacheLife({ revalidate: 60 * 60 });

	const projectRowId = await resolveProjectRowId(projectId);

	const [questions, rubrics, booleanRubrics, numericalRubrics, ordinalMarks] =
		await Promise.all([
			db
				.selectFrom("question")
				.where("question.projectId", "=", projectRowId)
				.select(["id", "label", "position"])
				.orderBy("position", "asc")
				.execute(),
			db
				.selectFrom("rubric")
				.innerJoin("question", "question.rowId", "rubric.questionId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as id",
					"question.id as questionId",
					"rubric.position as position",
					"rubric.description as description",
					"rubric.label as label",
					"rubric.type as type",
				])
				.orderBy("rubric.position", "asc")
				.execute(),
			db
				.selectFrom("booleanRubric")
				.innerJoin("rubric", "rubric.rowId", "booleanRubric.rubricId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as rubricId",
					"booleanRubric.marks as marks",
					"booleanRubric.falseMarks as falseMarks",
				])
				.execute(),
			db
				.selectFrom("numericalRubric")
				.innerJoin("rubric", "rubric.rowId", "numericalRubric.rubricId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as rubricId",
					"numericalRubric.minScore as minScore",
					"numericalRubric.maxScore as maxScore",
					"numericalRubric.minMarks as minMarks",
					"numericalRubric.maxMarks as maxMarks",
					"numericalRubric.reversed as reversed",
				])
				.execute(),
			db
				.selectFrom("ordinalRubric")
				.innerJoin(
					"ordinalRubricValue",
					"ordinalRubricValue.ordinalRubricId",
					"ordinalRubric.id",
				)
				.innerJoin("rubric", "rubric.rowId", "ordinalRubric.rubricId")
				.where("rubric.projectId", "=", projectRowId)
				.select([
					"rubric.id as rubricId",
					"ordinalRubricValue.label as label",
					"ordinalRubricValue.marks as marks",
				])
				.orderBy("ordinalRubricValue.marks", "desc")
				.orderBy("ordinalRubricValue.label", "asc")
				.execute(),
		]);

	const booleanRubricById = new Map(
		booleanRubrics.map((row) => [
			row.rubricId,
			{ marks: toNumber(row.marks), falseMarks: toNumber(row.falseMarks) },
		]),
	);

	const numericalRubricById = new Map(
		numericalRubrics.map((row) => [
			row.rubricId,
			{
				minScore: toNumber(row.minScore),
				maxScore: toNumber(row.maxScore),
				minMarks: toNumber(row.minMarks),
				maxMarks: toNumber(row.maxMarks),
				reversed: row.reversed,
			},
		]),
	);

	const ordinalMarksByRubricId = new Map<
		string,
		{ label: string; marks: number }[]
	>();
	for (const row of ordinalMarks) {
		const list = ordinalMarksByRubricId.get(row.rubricId) ?? [];
		list.push({ label: row.label, marks: toNumber(row.marks) });
		ordinalMarksByRubricId.set(row.rubricId, list);
	}

	const rubricsByQuestionId = new Map<
		string,
		Array<{
			id: string;
			questionId: string;
			description: string | null;
			label: string | null;
			type: RubricType;
		}>
	>();
	for (const rubric of rubrics) {
		const list = rubricsByQuestionId.get(rubric.questionId) ?? [];
		list.push(rubric);
		rubricsByQuestionId.set(rubric.questionId, list);
	}

	return questions.map((question) => {
		const questionRubrics = rubricsByQuestionId.get(question.id) ?? [];

		return {
			id: question.id,
			label: question.label,
			rubrics: questionRubrics.map((rubric) => ({
				id: rubric.id,
				type: rubric.type,
				description: rubric.description,
				label: rubric.label,
				booleanRubric: booleanRubricById.get(rubric.id) ?? null,
				ordinalRubric: ordinalMarksByRubricId.has(rubric.id)
					? { marks: ordinalMarksByRubricId.get(rubric.id) ?? [] }
					: null,
				numericalRubric: numericalRubricById.get(rubric.id) ?? null,
			})),
		};
	});
}

export async function loadQuestions(projectId: string): Promise<Grid> {
	"use cache";
	cacheTags(CACHE_TAGS.questions);

	const rows = await loadQuestionsFromDb(projectId);

	return Object.fromEntries(
		rows.map((row) => [
			row.id,
			{ label: row.label ?? undefined, rubrics: row.rubrics.map(toRubric) },
		]),
	);
}

export async function loadQuestion(
	questionId: string,
	projectId: string,
): Promise<Question | undefined> {
	const rows = await loadQuestionsFromDb(projectId);
	const row = rows.find((item) => item.id === questionId);

	if (row == null) {
		return undefined;
	}

	return { label: row.label ?? undefined, rubrics: row.rubrics.map(toRubric) };
}
