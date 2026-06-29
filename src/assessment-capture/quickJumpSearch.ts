import Fuse, { type FuseResultMatch } from "fuse.js";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import type { Submission } from "#submissions/types.ts";

export type SubmissionSearchTarget = {
	submissionId: string;
	displayLabel: string;
	memberNames: string[];
	progress: { completed: number; total: number };
	isCompleted: boolean;
};

export type SubmissionSearchResult = SubmissionSearchTarget & {
	combinedScore: number;
	matchReason: string;
};

const DEFAULT_FUSE_THRESHOLD = 0.3;

function normalizeQuery(query: string): string {
	return query.trim().replace(/\s+/g, " ");
}

function normalizeForCompare(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getBusinessBoost(
	target: SubmissionSearchTarget,
	query: string,
): number {
	const normalizedQuery = normalizeForCompare(query);
	if (normalizedQuery.length === 0) {
		return 0;
	}

	const normalizedLabel = normalizeForCompare(target.displayLabel);
	if (normalizedLabel === normalizedQuery) {
		return 100;
	}
	if (normalizedLabel.startsWith(normalizedQuery)) {
		return 80;
	}

	for (const memberName of target.memberNames) {
		const normalizedMember = normalizeForCompare(memberName);
		if (normalizedMember === normalizedQuery) {
			return 50;
		}
		if (normalizedMember.startsWith(normalizedQuery)) {
			return 35;
		}
	}

	return 0;
}

function getMatchReason(
	target: SubmissionSearchTarget,
	query: string,
	matches: readonly FuseResultMatch[] | undefined,
): string {
	const normalizedQuery = normalizeForCompare(query);
	if (normalizedQuery.length === 0) {
		return "";
	}

	const normalizedLabel = normalizeForCompare(target.displayLabel);
	const isTeam = target.memberNames.length > 0;

	if (normalizedLabel === normalizedQuery) {
		const label = isTeam ? "team" : "student";
		return `matched ${label}: "${target.displayLabel}"`;
	}
	if (normalizedLabel.startsWith(normalizedQuery)) {
		const label = isTeam ? "team" : "student";
		return `matched ${label}: "${target.displayLabel}"`;
	}

	// Check if any member name matched (only for teams)
	for (const memberName of target.memberNames) {
		const normalizedMember = normalizeForCompare(memberName);
		if (normalizedMember === normalizedQuery) {
			return `matched student: "${memberName}"`;
		}
		if (normalizedMember.startsWith(normalizedQuery)) {
			return `matched student: "${memberName}"`;
		}
	}

	// If we have fuzzy match info, try to determine what matched
	if (matches != null) {
		const match = matches[0];
		if (match == null) {
			return "";
		}
		if (match.key === "displayLabel") {
			const label = isTeam ? "team" : "student";
			return `matched ${label}: "${target.displayLabel}"`;
		}
		if (match.key === "memberNames") {
			// Find which member name was matched by doing a fuzzy check
			for (const memberName of target.memberNames) {
				const normalizedMember = normalizeForCompare(memberName);
				if (normalizedMember.includes(normalizedQuery)) {
					return `matched student: "${memberName}"`;
				}
			}
		}
	}

	// Fallback
	return "";
}

export function buildSubmissionSearchTargets(
	submissions: Submission[],
	progressBySubmissionId: Record<
		string,
		{ completed: number; total: number }
	> = {},
): SubmissionSearchTarget[] {
	return submissions.map((submission) => {
		const progress = progressBySubmissionId[submission.id] ?? {
			completed: 0,
			total: 0,
		};

		return {
			submissionId: submission.id,
			displayLabel: getSubmissionLabel(submission),
			memberNames: submission.memberNames ?? [],
			progress,
			isCompleted: progress.total > 0 && progress.completed >= progress.total,
		};
	});
}

export function createSubmissionSearch(
	targets: SubmissionSearchTarget[],
): (query: string) => SubmissionSearchResult[] {
	const orderBySubmissionId = new Map(
		targets.map((target, index) => [target.submissionId, index]),
	);

	const fuse = new Fuse(targets, {
		keys: ["displayLabel", "memberNames"],
		threshold: DEFAULT_FUSE_THRESHOLD,
		ignoreLocation: true,
		minMatchCharLength: 1,
		shouldSort: true,
		includeScore: true,
		includeMatches: true,
	});

	return (query: string) => {
		const normalizedQuery = normalizeQuery(query);

		if (normalizedQuery.length === 0) {
			return targets
				.slice(0, 20)
				.map((target) => ({ ...target, combinedScore: 0, matchReason: "" }));
		}

		const results = fuse.search(normalizedQuery, { limit: 20 });

		return results
			.map((result) => {
				const fuseScore = result.score ?? 1;
				const businessBoost = getBusinessBoost(result.item, normalizedQuery);
				const combinedScore = (1 - fuseScore) * 100 + businessBoost;
				const matchReason = getMatchReason(
					result.item,
					normalizedQuery,
					result.matches,
				);
				return { ...result.item, combinedScore, matchReason };
			})
			.sort(
				(a, b) =>
					b.combinedScore - a.combinedScore ||
					(orderBySubmissionId.get(a.submissionId) ?? Number.MAX_SAFE_INTEGER) -
						(orderBySubmissionId.get(b.submissionId) ??
							Number.MAX_SAFE_INTEGER),
			);
	};
}
