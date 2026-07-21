import type { Selectable } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { Simplify } from "#utils/utils.ts";

// The persisted grade_target no longer stores a kind (ADR 0014): individual
// vs group is a presentation shape derived at read time from name + member
// count. This union names that derived shape, and also the import/export CSV
// `kind` column vocabulary, both of which still distinguish the two.
export type GradeTargetKind = "individual" | "group";

// The only native grade_target column shared by the display and identity
// shapes below. `kind`/`studentRowId`/`groupRowId` are gone; the shapes carry
// a derived `kind` literal instead.
type GradeTargetBase = Pick<Selectable<Database["gradeTarget"]>, "id">;

type GradeTargetDisplay = {
	displayLabel?: string | undefined;
	// The cosmetic URL slug (`toTargetSlug` of the display label), always set
	// by `loadGradeTargets`. Callers building object literals directly (tests,
	// stories) must supply one too.
	slug?: string | undefined;
	memberNames?: string[] | undefined;
	searchKeys?: string[] | undefined;
};

// UI-facing shape: label, slug, and search metadata for rendering a grade
// target in lists and pickers. `kind` is derived by `loadGradeTargets` (see
// its name-OR-multimember rule), not read from a column.
export type GradeTarget =
	| Simplify<
			GradeTargetDisplay &
				GradeTargetBase & {
					kind: "individual";
					studentName: string;
					groupName?: undefined;
				}
	  >
	| Simplify<
			GradeTargetDisplay &
				GradeTargetBase & {
					kind: "group";
					studentName?: undefined;
					groupName: string;
				}
	  >;

// Identity-only shape: how a grade target renders in an export row. `kind`,
// `studentId`, and `groupName` are all derived at read time from the target's
// name and membership, not from native grade_target columns, so they're
// hand-written here rather than derived from Selectable<Database["gradeTarget"]>.
export type GradeTargetIdentity =
	| Simplify<
			GradeTargetBase & {
				kind: "individual";
				studentId: string;
				groupName?: undefined;
			}
	  >
	| Simplify<
			GradeTargetBase & {
				kind: "group";
				studentId?: undefined;
				groupName: string;
			}
	  >;
