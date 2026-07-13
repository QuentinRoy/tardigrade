import type { GradeTargetKind } from "#db/generated/public/GradeTargetKind.ts";
import type { Simplify } from "#utils/utils.ts";

export type { GradeTargetKind };

type GradeTargetBase = { id: string; kind: GradeTargetKind };

type GradeTargetDisplay = {
	displayLabel?: string | undefined;
	// The cosmetic URL slug (`toTargetSlug` of the display label), always set
	// by `loadGradeTargets`. Callers building object literals directly (tests,
	// stories) must supply one too.
	slug?: string | undefined;
	memberNames?: string[] | undefined;
	searchKeys?: string[] | undefined;
};

// FIXME: GradeTargetDisplay part doesn't seem like it belongs here
// since it's mostly UI facing. GradeTarget vs GradeTargetSubmitter
// is awkward (unclear what's what). Also we should strive
// to derive from Kysely types (e.g. using Selectable) instead of
// defining new ones.
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

export type GradeTargetSubmitter =
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
