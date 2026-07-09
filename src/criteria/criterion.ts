import { assertNever } from "#utils/utils.ts";
import type {
	AssessedCriterion,
	AssessmentCriterionValue,
	Criterion,
	CriterionForKind,
	CriterionKind,
} from "./types.ts";

export function getCriterionMaxMarks(criterion: Criterion): number {
	switch (criterion.kind) {
		case "check":
			return Math.max(criterion.marks, criterion.falseMarks);
		case "options":
			return Math.max(0, ...Object.values(criterion.marks));
		case "number":
			return criterion.maxMarks;
		default:
			assertNever(criterion);
	}
}

export function getCriterionMinMarks(criterion: Criterion): number {
	switch (criterion.kind) {
		case "check":
			return Math.min(criterion.marks, criterion.falseMarks);
		case "options":
			return Math.min(0, ...Object.values(criterion.marks));
		case "number":
			return criterion.minMarks;
		default:
			assertNever(criterion);
	}
}

export function markNumberCriterion(
	criterion: CriterionForKind<"number">,
	score: number,
): number {
	const scoreRange = criterion.maxScore - criterion.minScore;
	if (scoreRange === 0) {
		throw new Error(
			`Cannot mark a number criterion with a zero-width score range (minScore and maxScore are both ${criterion.minScore})`,
		);
	}

	const scoreOffset = criterion.reversed
		? criterion.maxScore - score
		: score - criterion.minScore;

	return (
		criterion.minMarks +
		(scoreOffset * (criterion.maxMarks - criterion.minMarks)) / scoreRange
	);
}

export function markCheckCriterion(
	criterion: CriterionForKind<"check">,
	passed: boolean,
): number {
	return passed ? criterion.marks : criterion.falseMarks;
}

export function markOptionsCriterion(
	criterion: CriterionForKind<"options">,
	selectedLabel: string,
): number {
	const marksForLabel = criterion.marks[selectedLabel];
	if (marksForLabel == null) {
		throw new Error(
			`Selected label "${selectedLabel}" not found in criterion marks`,
		);
	}
	return marksForLabel;
}

export function markCriterion<TKind extends CriterionKind = CriterionKind>(
	criterion: AssessedCriterion<TKind>,
): number {
	if (criterion.assessment == null) {
		return 0;
	}
	switch (criterion.kind) {
		case "check":
			return markCheckCriterion(criterion, criterion.assessment.passed);
		case "options":
			return markOptionsCriterion(
				criterion,
				criterion.assessment.selectedLabel,
			);
		case "number":
			return markNumberCriterion(criterion, criterion.assessment.score);
		default:
			assertNever(criterion);
	}
}

export function attachAssessment<TKind extends CriterionKind>(
	criterion: CriterionForKind<TKind>,
	source: AssessmentCriterionValue | AssessmentCriterionValue[] | undefined,
): AssessedCriterion<TKind> {
	switch (criterion.kind) {
		// TypeScript does not narrow a free generic type parameter (TKind) inside
		// case branches, so it cannot verify that e.g. AssessedCheckCriterion
		// satisfies AssessedCriterion<TKind>. assertCriterionKind() guarantees the
		// branch matches before each call, making the casts safe.
		case "check":
			assertCriterionKind(criterion, "check");
			// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
			return attachCheckAssessment(
				criterion,
				source,
			) as AssessedCriterion<TKind>;
		case "options":
			assertCriterionKind(criterion, "options");
			// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
			return attachOptionsAssessment(
				criterion,
				source,
			) as AssessedCriterion<TKind>;
		case "number":
			assertCriterionKind(criterion, "number");
			// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
			return attachNumberAssessment(
				criterion,
				source,
			) as AssessedCriterion<TKind>;
		default:
			return assertNever(criterion.kind);
	}
}

function assertCriterionKind<TExpected extends CriterionKind>(
	criterion: Criterion,
	expected: TExpected,
): asserts criterion is CriterionForKind<TExpected> {
	if (criterion.kind !== expected) {
		throw new Error(
			`Expected criterion kind ${expected}, got ${criterion.kind}`,
		);
	}
}

function attachCheckAssessment(
	criterion: CriterionForKind<"check">,
	source: AssessmentCriterionValue | AssessmentCriterionValue[] | undefined,
): AssessedCriterion<"check"> {
	const assessment = findAssessment(criterion.id, source);
	return {
		...criterion,
		assessment:
			assessment?.kind === "check" ? { passed: assessment.passed } : null,
	};
}

function attachOptionsAssessment(
	criterion: CriterionForKind<"options">,
	source: AssessmentCriterionValue | AssessmentCriterionValue[] | undefined,
): AssessedCriterion<"options"> {
	const assessment = findAssessment(criterion.id, source);
	return {
		...criterion,
		assessment:
			assessment?.kind === "options"
				? { selectedLabel: assessment.selectedLabel }
				: null,
	};
}

function attachNumberAssessment(
	criterion: CriterionForKind<"number">,
	source: AssessmentCriterionValue | AssessmentCriterionValue[] | undefined,
): AssessedCriterion<"number"> {
	const assessment = findAssessment(criterion.id, source);
	return {
		...criterion,
		assessment:
			assessment?.kind === "number" ? { score: assessment.score } : null,
	};
}

function findAssessment(
	criterionId: string,
	source:
		| AssessmentCriterionValue
		| AssessmentCriterionValue[]
		| null
		| undefined,
): AssessmentCriterionValue | null {
	if (source == null) {
		return null;
	}

	if (Array.isArray(source)) {
		return source.find((item) => item.criterionId === criterionId) ?? null;
	}

	if (source.criterionId !== criterionId) {
		return null;
	}

	return source;
}
