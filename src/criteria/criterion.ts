import { assertNever } from "#utils/utils.ts";
import {
	getCheckCriterionMaxMarks,
	getCheckCriterionMinMarks,
	isSameCheckGrade,
	markCheckCriterion,
} from "./check/checkDomain.ts";
import {
	getNumberCriterionMaxMarks,
	getNumberCriterionMinMarks,
	isSameNumberGrade,
	markNumberCriterion,
} from "./number/numberDomain.ts";
import {
	getOptionsCriterionMaxMarks,
	getOptionsCriterionMinMarks,
	isSameOptionsGrade,
	markOptionsCriterion,
} from "./options/optionsDomain.ts";
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
			return getOptionsCriterionMaxMarks(criterion);
		case "number":
			return getNumberCriterionMaxMarks(criterion);
		default:
			assertNever(criterion);
	}
}

export function getCriterionMinMarks(criterion: Criterion): number {
	switch (criterion.kind) {
		case "check":
			return getCheckCriterionMinMarks(criterion);
		case "options":
			return getOptionsCriterionMinMarks(criterion);
		case "number":
			return getNumberCriterionMinMarks(criterion);
		default:
			assertNever(criterion);
	}
}

export function markCriterion<TKind extends CriterionKind = CriterionKind>(
	criterion: GradedCriterion<TKind>,
): number {
	if (criterion.grade == null) {
		return 0;
	}
	switch (criterion.kind) {
		case "check":
			return markCheckCriterion(criterion, criterion.grade);
		case "options":
			return markOptionsCriterion(criterion, criterion.grade);
		case "number":
			return markNumberCriterion(criterion, criterion.grade);
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

// Whether a criterion already holds the grade being saved, so callers can skip
// a no-op write. A grade for another criterion, or of another kind, never
// matches; comparing the grade content itself is kind knowledge and dispatches
// to the kind folders (ADR 0013).
export function hasSameGrade(
	criterion: GradedCriterion,
	grade: CriterionGrade,
): boolean {
	if (criterion.grade == null || grade.criterionId !== criterion.id) {
		return false;
	}

	switch (criterion.kind) {
		case "check":
			return grade.kind === "check" && isSameCheckGrade(criterion.grade, grade);
		case "options":
			return (
				grade.kind === "options" && isSameOptionsGrade(criterion.grade, grade)
			);
		case "number":
			return (
				grade.kind === "number" && isSameNumberGrade(criterion.grade, grade)
			);
		default:
			return assertNever(criterion);
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
