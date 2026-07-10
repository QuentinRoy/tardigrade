import type { SubmissionType } from "#db/generated/db.ts";
import type { Simplify } from "#utils/utils.ts";

export type { SubmissionType };

type SubmissionBase = { id: string; type: SubmissionType };

type SubmissionDisplay = {
	displayLabel?: string | undefined;
	memberNames?: string[] | undefined;
	searchKeys?: string[] | undefined;
};

// FIXME: SubmissionDisplay part doesn't seem like it belongs here
// since it's mostly UI facing. Submission vs SubmissionSubmitter
// is awkward (unclear what's what). Also we should strive
// to derive from Kysely types (e.g. using Selectable) instead of
// defining new ones.
export type Submission =
	| Simplify<
			SubmissionDisplay &
				SubmissionBase & {
					type: "individual";
					studentName: string;
					groupName?: undefined;
				}
	  >
	| Simplify<
			SubmissionDisplay &
				SubmissionBase & {
					type: "group";
					studentName?: undefined;
					groupName: string;
				}
	  >;

export type SubmissionSubmitter =
	| Simplify<
			SubmissionBase & {
				type: "individual";
				studentId: string;
				groupName?: undefined;
			}
	  >
	| Simplify<
			SubmissionBase & {
				type: "group";
				studentId?: undefined;
				groupName: string;
			}
	  >;
