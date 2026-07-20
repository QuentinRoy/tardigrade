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
	CriterionForKind,
	CriterionGrade,
	CriterionGradeContentForKind,
	CriterionKind,
	GradedCriterion,
	MarkedCriterion,
} from "./types.ts";

// Per-kind operation bundle (ADR 0013's union-keyed kind map). Each dispatcher
// below stays generic in TKind so `operationsByKind[criterion.kind]` resolves to
// one entry; indexing with a concrete `CriterionKind` would instead yield a
// union of per-kind signatures, which has no callable form.
type CriterionOperations<TKind extends CriterionKind> = {
	getMaxMarks: (criterion: CriterionForKind<TKind>) => number;
	getMinMarks: (criterion: CriterionForKind<TKind>) => number;
	mark: (criterion: MarkedCriterion<TKind>) => number;
	attachGrade: (
		criterion: CriterionForKind<TKind>,
		grade: CriterionGrade<TKind> | null,
	) => GradedCriterion<TKind>;
};

// Entered in the table once per kind, so each instance pairs a criterion with
// its own kind's grade content at a concrete kind. Building the same object
// under a free TKind instead would leave TypeScript unable to tie the two
// halves together.
function attachGradeOfKind<TKind extends CriterionKind>(
	criterion: CriterionForKind<TKind>,
	grade: CriterionGrade<TKind> | null,
) {
	return { ...criterion, grade: grade == null ? null : toGradeContent(grade) };
}

const operationsByKind: {
	[TKind in CriterionKind]: CriterionOperations<TKind>;
} = {
	check: {
		getMaxMarks: getCheckCriterionMaxMarks,
		getMinMarks: getCheckCriterionMinMarks,
		mark: markCheckCriterion,
		attachGrade: attachGradeOfKind,
	},
	options: {
		getMaxMarks: getOptionsCriterionMaxMarks,
		getMinMarks: getOptionsCriterionMinMarks,
		mark: markOptionsCriterion,
		attachGrade: attachGradeOfKind,
	},
	number: {
		getMaxMarks: getNumberCriterionMaxMarks,
		getMinMarks: getNumberCriterionMinMarks,
		mark: markNumberCriterion,
		attachGrade: attachGradeOfKind,
	},
};

export function getCriterionMaxMarks<TKind extends CriterionKind>(
	criterion: CriterionForKind<TKind>,
): number {
	return operationsByKind[criterion.kind].getMaxMarks(criterion);
}

export function getCriterionMinMarks<TKind extends CriterionKind>(
	criterion: CriterionForKind<TKind>,
): number {
	return operationsByKind[criterion.kind].getMinMarks(criterion);
}

// An ungraded criterion scores 0; the kind's marking rule only ever sees a
// criterion that carries a grade.
export function markCriterion<TKind extends CriterionKind = CriterionKind>(
	criterion: GradedCriterion<TKind>,
): number {
	if (!hasGrade(criterion)) {
		return 0;
	}
	return operationsByKind[criterion.kind].mark(criterion);
}

// Narrows the criterion itself, not just its `grade` property, so the result
// can be handed to a marking rule that requires a grade.
function hasGrade<TCriterion extends { grade: unknown }>(
	criterion: TCriterion,
): criterion is TCriterion & { grade: NonNullable<TCriterion["grade"]> } {
	return criterion.grade != null;
}

export function attachGrade<TKind extends CriterionKind>(
	criterion: CriterionForKind<TKind>,
	source: CriterionGrade | CriterionGrade[] | undefined,
): GradedCriterion<TKind> {
	const grade = findGrade({ criterion, source });
	return operationsByKind[criterion.kind].attachGrade(criterion, grade);
}

// Grade content is the grade minus the identity fields the criterion already
// carries.
function toGradeContent<TKind extends CriterionKind>(
	grade: CriterionGrade<TKind>,
): CriterionGradeContentForKind<TKind> {
	const { criterionId, kind, ...content } = grade;
	return content;
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

// The criterion's own grade out of `source`, or null when it holds none. A
// grade stored under this criterion always carries the criterion's kind (it is
// read back from the criterion itself), so a mismatch is a broken invariant
// rather than a case to fall back on.
function findGrade<TKind extends CriterionKind>({
	criterion,
	source,
}: {
	criterion: CriterionForKind<TKind>;
	source: CriterionGrade | CriterionGrade[] | null | undefined;
}): CriterionGrade<TKind> | null {
	if (source == null) {
		return null;
	}

	const grades = Array.isArray(source) ? source : [source];
	const grade = grades.find((item) => item.criterionId === criterion.id);
	if (grade == null) {
		return null;
	}

	if (!isGradeOfCriterionKind(grade, criterion)) {
		throw new Error(
			`Grade for criterion ${criterion.id} is of kind ${grade.kind}, but the criterion is of kind ${criterion.kind}`,
		);
	}

	return grade;
}

// Written as a type guard because the kind equality it checks is exactly the
// Extract behind CriterionGrade<TKind>, which TypeScript cannot apply as a
// narrowing while TKind is a free type parameter.
function isGradeOfCriterionKind<TKind extends CriterionKind>(
	grade: CriterionGrade,
	criterion: CriterionForKind<TKind>,
): grade is CriterionGrade<TKind> {
	return grade.kind === criterion.kind;
}
