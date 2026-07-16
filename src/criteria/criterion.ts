import { assertNever } from "#utils/utils.ts";
import {
	getCheckCriterionMaxMarks,
	getCheckCriterionMinMarks,
	markCheckCriterion,
} from "./check/checkDomain.ts";
import type {
	Criterion,
	CriterionForKind,
	CriterionGrade,
	CriterionKind,
	GradedCriterion,
} from "./types.ts";

export function getCriterionMaxMarks(criterion: Criterion): number {
	switch (criterion.kind) {
		case "check":
			return getCheckCriterionMaxMarks(criterion);
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
			return getCheckCriterionMinMarks(criterion);
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
	value: number,
): number {
	const valueRange = criterion.maxValue - criterion.minValue;
	if (valueRange === 0) {
		throw new Error(
			`Cannot mark a number criterion with a zero-width value range (minValue and maxValue are both ${criterion.minValue})`,
		);
	}

	const valueOffset = criterion.reversed
		? criterion.maxValue - value
		: value - criterion.minValue;

	return (
		criterion.minMarks +
		(valueOffset * (criterion.maxMarks - criterion.minMarks)) / valueRange
	);
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
	criterion: GradedCriterion<TKind>,
): number {
	if (criterion.grade == null) {
		return 0;
	}
	switch (criterion.kind) {
		case "check":
			return markCheckCriterion(criterion, criterion.grade.passed);
		case "options":
			return markOptionsCriterion(criterion, criterion.grade.selectedLabel);
		case "number":
			return markNumberCriterion(criterion, criterion.grade.value);
		default:
			assertNever(criterion);
	}
}

export function attachGrade<TKind extends CriterionKind>(
	criterion: CriterionForKind<TKind>,
	source: CriterionGrade | CriterionGrade[] | undefined,
): GradedCriterion<TKind> {
	switch (criterion.kind) {
		// TypeScript does not narrow a free generic type parameter (TKind) inside
		// case branches, so it cannot verify that e.g. GradedCheckCriterion
		// satisfies GradedCriterion<TKind>. assertCriterionKind() guarantees the
		// branch matches before each call, making the casts safe.
		case "check":
			assertCriterionKind(criterion, "check");
			// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
			return attachCheckGrade(criterion, source) as GradedCriterion<TKind>;
		case "options":
			assertCriterionKind(criterion, "options");
			// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
			return attachOptionsGrade(criterion, source) as GradedCriterion<TKind>;
		case "number":
			assertCriterionKind(criterion, "number");
			// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
			return attachNumberGrade(criterion, source) as GradedCriterion<TKind>;
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

function attachCheckGrade(
	criterion: CriterionForKind<"check">,
	source: CriterionGrade | CriterionGrade[] | undefined,
): GradedCriterion<"check"> {
	const grade = findGrade(criterion.id, source);
	return {
		...criterion,
		grade: grade?.kind === "check" ? { passed: grade.passed } : null,
	};
}

function attachOptionsGrade(
	criterion: CriterionForKind<"options">,
	source: CriterionGrade | CriterionGrade[] | undefined,
): GradedCriterion<"options"> {
	const grade = findGrade(criterion.id, source);
	return {
		...criterion,
		grade:
			grade?.kind === "options" ? { selectedLabel: grade.selectedLabel } : null,
	};
}

function attachNumberGrade(
	criterion: CriterionForKind<"number">,
	source: CriterionGrade | CriterionGrade[] | undefined,
): GradedCriterion<"number"> {
	const grade = findGrade(criterion.id, source);
	return {
		...criterion,
		grade: grade?.kind === "number" ? { value: grade.value } : null,
	};
}

function findGrade(
	criterionId: string,
	source: CriterionGrade | CriterionGrade[] | null | undefined,
): CriterionGrade | null {
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
