import { expect, test } from "vitest";
import type { ImportedQuestions } from "#imports/types.ts";
import {
	prepareQuestionImport,
	type QuestionImportContext,
} from "./prepareQuestionImport.ts";

function buildContext(
	overrides: Partial<QuestionImportContext> = {},
): QuestionImportContext {
	return { existingCriteriaById: new Map(), ...overrides };
}

test("prepareQuestionImport plans question and criterion upserts from parsed questions", () => {
	const questions: ImportedQuestions = [
		{
			id: "q1",
			label: "Question 1",
			criteria: [{ id: "r1", kind: "check", label: "Criterion 1", marks: 2 }],
		},
	];

	const plan = prepareQuestionImport({ questions, context: buildContext() });

	expect(plan.writes).toEqual(questions);
	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.criterionTypeChanges).toEqual([]);
});

test("prepareQuestionImport blocks a criterion type change when assessments are linked", () => {
	const questions: ImportedQuestions = [
		{
			id: "q1",
			label: "Question 1",
			criteria: [
				{
					id: "r1",
					kind: "options",
					label: "Criterion 1",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const context = buildContext({
		existingCriteriaById: new Map([
			["r1", { kind: "check", questionId: "q1", assessmentCount: 3 }],
		]),
	});

	const plan = prepareQuestionImport({ questions, context });

	expect(plan.blockingDiagnostics).toEqual([
		{
			kind: "criterion-type-change-blocked",
			questionId: "q1",
			criterionId: "r1",
			assessmentCount: 3,
		},
	]);
	expect(plan.criterionTypeChanges).toEqual([]);
});

test("prepareQuestionImport allows and reports a criterion type change with no linked assessments", () => {
	const questions: ImportedQuestions = [
		{
			id: "q1",
			label: "Question 1",
			criteria: [
				{
					id: "r1",
					kind: "options",
					label: "Criterion 1",
					marks: { good: 1, bad: 0 },
				},
			],
		},
	];

	const context = buildContext({
		existingCriteriaById: new Map([
			["r1", { kind: "check", questionId: "q1", assessmentCount: 0 }],
		]),
	});

	const plan = prepareQuestionImport({ questions, context });

	expect(plan.blockingDiagnostics).toEqual([]);
	expect(plan.criterionTypeChanges).toEqual([
		{
			questionId: "q1",
			criterionId: "r1",
			fromType: "check",
			toType: "options",
		},
	]);
});

test("prepareQuestionImport blocks when an imported criterion id belongs to another question", () => {
	const questions: ImportedQuestions = [
		{
			id: "q2",
			label: "Question 2",
			criteria: [{ id: "r1", kind: "check", label: "Criterion 1", marks: 2 }],
		},
	];

	const context = buildContext({
		existingCriteriaById: new Map([
			["r1", { kind: "check", questionId: "q1", assessmentCount: 0 }],
		]),
	});

	const plan = prepareQuestionImport({ questions, context });

	expect(plan.blockingDiagnostics).toEqual([
		{
			kind: "criterion-question-mismatch",
			criterionId: "r1",
			importQuestionId: "q2",
			existingQuestionId: "q1",
		},
	]);
});
