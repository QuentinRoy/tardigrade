import type { AssessmentRubricValue } from "#assessments/types.ts";
import { assertNever } from "#utils/utils.ts";
import type {
	AssessedRubric,
	Rubric,
	RubricForType,
	RubricType,
} from "./types.ts";

export function getRubricMaxMarks(rubric: Rubric): number {
	switch (rubric.type) {
		case "boolean":
			return Math.max(rubric.marks, rubric.falseMarks);
		case "ordinal":
			return Math.max(0, ...Object.values(rubric.marks));
		case "numerical":
			return rubric.maxMarks;
		default:
			assertNever(rubric);
	}
}

export function getRubricMinMarks(rubric: Rubric): number {
	switch (rubric.type) {
		case "boolean":
			return Math.min(rubric.marks, rubric.falseMarks);
		case "ordinal":
			return Math.min(0, ...Object.values(rubric.marks));
		case "numerical":
			return rubric.minMarks;
		default:
			assertNever(rubric);
	}
}

export function markNumericalRubric(
	rubric: RubricForType<"numerical">,
	score: number,
): number {
	const scoreRange = rubric.maxScore - rubric.minScore;
	if (scoreRange === 0) {
		throw new Error(
			`Cannot mark a numerical rubric with a zero-width score range (minScore and maxScore are both ${rubric.minScore})`,
		);
	}

	const scoreOffset = rubric.reversed
		? rubric.maxScore - score
		: score - rubric.minScore;

	return (
		rubric.minMarks +
		(scoreOffset * (rubric.maxMarks - rubric.minMarks)) / scoreRange
	);
}

export function markBooleanRubric(
	rubric: RubricForType<"boolean">,
	passed: boolean,
): number {
	return passed ? rubric.marks : rubric.falseMarks;
}

export function markOrdinalRubric(
	rubric: RubricForType<"ordinal">,
	selectedLabel: string,
): number {
	const marksForLabel = rubric.marks[selectedLabel];
	if (marksForLabel == null) {
		throw new Error(
			`Selected label "${selectedLabel}" not found in rubric marks`,
		);
	}
	return marksForLabel;
}

export function markRubric<TType extends RubricType = RubricType>(
	rubric: AssessedRubric<TType>,
): number {
	if (rubric.assessment == null) {
		return 0;
	}
	switch (rubric.type) {
		case "boolean":
			return markBooleanRubric(rubric, rubric.assessment.passed);
		case "ordinal":
			return markOrdinalRubric(rubric, rubric.assessment.selectedLabel);
		case "numerical":
			return markNumericalRubric(rubric, rubric.assessment.score);
		default:
			assertNever(rubric);
	}
}

export function attachAssessment<TType extends RubricType>(
	rubric: RubricForType<TType>,
	source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<TType> {
	switch (rubric.type) {
		// TypeScript does not narrow a free generic type parameter (TType) inside
		// case branches, so it cannot verify that e.g. AssessedBooleanRubric
		// satisfies AssessedRubric<TType>. assertRubricType() guarantees the branch
		// matches before each call, making the casts safe.
		case "boolean":
			assertRubricType(rubric, "boolean");
			return attachBooleanAssessment(rubric, source) as AssessedRubric<TType>;
		case "ordinal":
			assertRubricType(rubric, "ordinal");
			return attachOrdinalAssessment(rubric, source) as AssessedRubric<TType>;
		case "numerical":
			assertRubricType(rubric, "numerical");
			return attachNumericalAssessment(rubric, source) as AssessedRubric<TType>;
		default:
			return assertNever(rubric.type);
	}
}

function assertRubricType<TExpected extends RubricType>(
	rubric: Rubric,
	expected: TExpected,
): asserts rubric is RubricForType<TExpected> {
	if (rubric.type !== expected) {
		throw new Error(`Expected rubric type ${expected}, got ${rubric.type}`);
	}
}

function attachBooleanAssessment(
	rubric: RubricForType<"boolean">,
	source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<"boolean"> {
	const assessment = findAssessment(rubric.id, source);
	return {
		...rubric,
		assessment:
			assessment?.type === "boolean" ? { passed: assessment.passed } : null,
	};
}

function attachOrdinalAssessment(
	rubric: RubricForType<"ordinal">,
	source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<"ordinal"> {
	const assessment = findAssessment(rubric.id, source);
	return {
		...rubric,
		assessment:
			assessment?.type === "ordinal"
				? { selectedLabel: assessment.selectedLabel }
				: null,
	};
}

function attachNumericalAssessment(
	rubric: RubricForType<"numerical">,
	source: AssessmentRubricValue | AssessmentRubricValue[] | undefined,
): AssessedRubric<"numerical"> {
	const assessment = findAssessment(rubric.id, source);
	return {
		...rubric,
		assessment:
			assessment?.type === "numerical" ? { score: assessment.score } : null,
	};
}

function findAssessment(
	rubricId: string,
	source: AssessmentRubricValue | AssessmentRubricValue[] | null | undefined,
): AssessmentRubricValue | null {
	if (source == null) {
		return null;
	}

	if (Array.isArray(source)) {
		return source.find((item) => item.rubricId === rubricId) ?? null;
	}

	if (source.rubricId !== rubricId) {
		return null;
	}

	return source;
}
