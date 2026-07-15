import type { Selectable } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type { GradeTargetKind } from "#db/generated/public/GradeTargetKind.ts";
import type { Simplify } from "#utils/utils.ts";

export type { GradeTargetKind };

// Native grade_target columns, shared by the display and identity shapes below.
type GradeTargetBase = Pick<Selectable<Database["gradeTarget"]>, "id" | "kind">;

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
// target in lists and pickers.
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

// Identity-only shape: which student or group a grade target belongs to.
// studentId/groupName come from joining the student/group tables in queries,
// not from native grade_target columns, so they're hand-written here rather
// than derived from Selectable<Database["gradeTarget"]>.
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
