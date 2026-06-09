import "server-only";
import type { Kysely } from "kysely";
import type { DB } from "#db/generated/db.ts";
import { db as defaultDb } from "#db/kysely.ts";
import {
	loadQuestionRowsFromDb,
	resolveProjectRowId,
	toRubric,
} from "./questions.ts";
import type { QuestionDefinition } from "./types.ts";

export type RubricDefinitionInput =
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			type: "boolean";
			marks: number;
			falseMarks?: number | undefined;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			type: "ordinal";
			marks: Record<string, number>;
	  }
	| {
			previousId?: string | undefined;
			id: string;
			description?: string | undefined;
			label?: string | undefined;
			type: "numerical";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

export type QuestionDefinitionInput = {
	originalId?: string | undefined;
	id: string;
	label?: string | undefined;
	rubrics: RubricDefinitionInput[];
};

// `db` may be the global client or a caller-supplied transaction.
export async function loadQuestionDefinitionsFromDb(
	db: Kysely<DB>,
	{ projectId }: { projectId: string },
): Promise<QuestionDefinition[]> {
	const [rows, counts] = await Promise.all([
		loadQuestionRowsFromDb(db, { projectId }),
		db
			.selectFrom("assessment")
			.innerJoin("question", "question.rowId", "assessment.questionId")
			.innerJoin("project", "project.rowId", "assessment.projectId")
			.where("project.id", "=", projectId)
			.select(({ fn }) => [
				"question.id as questionId",
				fn.count<number>("assessment.id").as("assessmentCount"),
			])
			.groupBy("question.id")
			.execute(),
	]);

	const assessmentCountByQuestionId = new Map(
		counts.map((count) => [count.questionId, Number(count.assessmentCount)]),
	);

	return rows.map((row, position) => ({
		id: row.id,
		position,
		assessmentCount: assessmentCountByQuestionId.get(row.id) ?? 0,
		question: {
			label: row.label ?? undefined,
			rubrics: row.rubrics.map(toRubric),
		},
	}));
}

export async function loadQuestionDefinitions(
	{ projectId }: { projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<QuestionDefinition[]> {
	return loadQuestionDefinitionsFromDb(db, { projectId });
}

// `db` may be the global client or a caller-supplied transaction.
export async function getQuestionDefinitionDeleteImpactFromDb(
	db: Kysely<DB>,
	{ questionId, projectId }: { questionId: string; projectId: string },
): Promise<{ assessmentCount: number }> {
	const projectRowId = await resolveProjectRowId(db, projectId);

	const row = await db
		.selectFrom("assessment")
		.innerJoin("question", "question.rowId", "assessment.questionId")
		.select(({ fn }) => [
			fn.count<number>("assessment.id").as("assessmentCount"),
		])
		.where("question.id", "=", questionId)
		.where("assessment.projectId", "=", projectRowId)
		.executeTakeFirst();

	return { assessmentCount: Number(row?.assessmentCount ?? 0) };
}

export async function getQuestionDefinitionDeleteImpact(
	{ questionId, projectId }: { questionId: string; projectId: string },
	{ db = defaultDb }: { db?: Kysely<DB> } = {},
): Promise<{ assessmentCount: number }> {
	return getQuestionDefinitionDeleteImpactFromDb(db, { questionId, projectId });
}
