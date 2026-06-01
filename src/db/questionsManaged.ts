import "server-only";
import { db } from "./kysely";
import {
	loadQuestionsFromDb,
	resolveProjectRowId,
	toRubric,
} from "./questionsRead";
import type { Question } from "./types";

export type ManagedRubricInput =
	| {
			previousId?: string;
			id: string;
			description?: string;
			label?: string;
			type: "boolean";
			marks: number;
			falseMarks?: number;
	  }
	| {
			previousId?: string;
			id: string;
			description?: string;
			label?: string;
			type: "ordinal";
			marks: Record<string, number>;
	  }
	| {
			previousId?: string;
			id: string;
			description?: string;
			label?: string;
			type: "numerical";
			minScore: number;
			maxScore: number;
			minMarks: number;
			maxMarks: number;
			reversed: boolean;
	  };

export type ManagedQuestionInput = {
	originalId?: string;
	id: string;
	label?: string;
	rubrics: ManagedRubricInput[];
};

export type ManagedQuestionSummary = {
	id: string;
	label?: string;
	position: number;
	assessmentCount: number;
	rubricCount: number;
};

export type ManagedQuestionDetails = ManagedQuestionSummary & {
	question: Question;
};

export async function loadManagedQuestions(
	projectId: string,
): Promise<ManagedQuestionDetails[]> {
	const [rows, counts] = await Promise.all([
		loadQuestionsFromDb(projectId),
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
		label: row.label ?? undefined,
		position,
		assessmentCount: assessmentCountByQuestionId.get(row.id) ?? 0,
		rubricCount: row.rubrics.length,
		question: {
			label: row.label ?? undefined,
			rubrics: row.rubrics.map(toRubric),
		},
	}));
}

export async function getQuestionDeleteImpact(
	questionId: string,
	projectId: string,
): Promise<{ assessmentCount: number }> {
	const projectRowId = await resolveProjectRowId(projectId);

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
