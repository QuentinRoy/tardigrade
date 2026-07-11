import Fuse, { type FuseResultMatch } from "fuse.js";
import { getGradeTargetLabel } from "#grade-targets/getGradeTargetLabel.ts";
import type { GradeTarget } from "#grade-targets/types.ts";

export type GradeTargetSearchTarget = {
	targetId: string;
	displayLabel: string;
	memberNames: string[];
	progress: { completed: number; total: number };
	isCompleted: boolean;
};

export type GradeTargetSearchResult = GradeTargetSearchTarget & {
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
	target: GradeTargetSearchTarget,
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
	target: GradeTargetSearchTarget,
	query: string,
	matches: readonly FuseResultMatch[] | undefined,
): string {
	const normalizedQuery = normalizeForCompare(query);
	if (normalizedQuery.length === 0) {
		return "";
	}

	const normalizedLabel = normalizeForCompare(target.displayLabel);
	const isGroup = target.memberNames.length > 0;

	if (normalizedLabel === normalizedQuery) {
		const label = isGroup ? "group" : "student";
		return `matched ${label}: "${target.displayLabel}"`;
	}
	if (normalizedLabel.startsWith(normalizedQuery)) {
		const label = isGroup ? "group" : "student";
		return `matched ${label}: "${target.displayLabel}"`;
	}

	// Check if any member name matched (only for groups)
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
			const label = isGroup ? "group" : "student";
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

export function buildGradeTargetSearchTargets(
	targets: GradeTarget[],
	progressByTargetId: Record<string, { completed: number; total: number }> = {},
): GradeTargetSearchTarget[] {
	return targets.map((target) => {
		const progress = progressByTargetId[target.id] ?? {
			completed: 0,
			total: 0,
		};

		return {
			targetId: target.id,
			displayLabel: getGradeTargetLabel(target),
			memberNames: target.memberNames ?? [],
			progress,
			isCompleted: progress.total > 0 && progress.completed >= progress.total,
		};
	});
}

export function createGradeTargetSearch(
	targets: GradeTargetSearchTarget[],
): (query: string) => GradeTargetSearchResult[] {
	const orderByTargetId = new Map(
		targets.map((target, index) => [target.targetId, index]),
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
					(orderByTargetId.get(a.targetId) ?? Number.MAX_SAFE_INTEGER) -
						(orderByTargetId.get(b.targetId) ?? Number.MAX_SAFE_INTEGER),
			);
	};
}
