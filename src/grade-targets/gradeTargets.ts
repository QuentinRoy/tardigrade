import "server-only";
import { type Kysely, sql } from "kysely";
import { cacheLife } from "next/cache";
import { allTargetsTag, cacheTags } from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database as defaultDb } from "#db/kysely.ts";
import type { GradeTarget } from "./types.ts";

export function gradeTargetsCacheTags({
	gridId,
}: {
	gridId: string;
}): string[] {
	return [allTargetsTag({ gridId })];
}

// Reserves `count` fresh public ids for `gridRowId`, contiguous from the
// grid's current per-grid maximum, for the caller's own transaction to
// assign to newly inserted rows. A candidate id that ends up on an
// `ON CONFLICT DO UPDATE` path (an upsert onto an already-existing row) is
// simply never persisted — `id` is never in that clause's `SET` list — so it
// costs a gap, never a collision; gaps and non-reuse-on-delete are accepted
// (see `docs/reference` migration notes; no deletion path exists today, #45).
export async function nextGradeTargetIds(
	db: Kysely<Database>,
	{ gridRowId, count }: { gridRowId: number; count: number },
): Promise<string[]> {
	if (count === 0) {
		return [];
	}

	const { max } = await db
		.selectFrom("gradeTarget")
		.select((eb) =>
			eb.fn.max(sql<number>`substring(${eb.ref("id")} from 3)::int`).as("max"),
		)
		.where("gridRowId", "=", gridRowId)
		.executeTakeFirstOrThrow();

	const start = (max ?? 0) + 1;
	return Array.from({ length: count }, (_, index) => `t-${start + index}`);
}

function normalizeSearchValue(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// Mirrors `toGridSlug` (`#grids/grids.ts`): a target's display label
// is always non-empty (student names and group names are validated non-empty
// at the import write boundary), so unlike a grid name there is no
// empty-label case to guard against here.
export function toTargetSlug(displayLabel: string): string {
	const normalized = normalizeSlug(displayLabel);
	if (normalized.length === 0) {
		throw new Error(
			"Grade target label must contain at least one letter or number.",
		);
	}
	if (normalized.length > 64) {
		throw new Error("Grade target slug must be 64 characters or fewer.");
	}
	return normalized;
}

function formatStudentName(lastName: string, firstName: string): string {
	return `${lastName} ${firstName}`.trim();
}

// `db` may be the global client or a caller-supplied transaction. `gridId`
// is required: `gradeTarget.id` is only unique within a grid, so an
// unscoped load would collide keys in `groupMembersByTargetId`.
export async function loadGradeTargetsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
) {
	const gridRowIdQuery = db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId);

	const [targets, groupMemberRows] = await Promise.all([
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.gridRowId", "in", gridRowIdQuery)
			.leftJoin("student", "student.rowId", "gradeTarget.studentRowId")
			.leftJoin("group", "group.id", "gradeTarget.groupRowId")
			.select([
				"gradeTarget.id as id",
				"gradeTarget.kind as kind",
				"student.lastName as studentLastName",
				"student.firstName as studentFirstName",
				"group.name as groupName",
			])
			// Creation order, not id order: `id` is a per-grid text ordinal
			// (`t-9` sorts after `t-12` lexicographically), so `rowId` (assigned
			// in insertion order) is the only column that sorts correctly.
			.orderBy("gradeTarget.rowId", "asc")
			.execute(),
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.gridRowId", "in", gridRowIdQuery)
			.innerJoin(
				"studentToGroup",
				"studentToGroup.groupId",
				"gradeTarget.groupRowId",
			)
			.innerJoin("student", "student.rowId", "studentToGroup.studentId")
			.where("gradeTarget.kind", "=", "group")
			.select([
				"gradeTarget.id as targetId",
				"student.lastName as studentLastName",
				"student.firstName as studentFirstName",
			])
			.orderBy("gradeTarget.rowId", "asc")
			.orderBy("student.lastName", "asc")
			.orderBy("student.firstName", "asc")
			.execute(),
	]);

	const groupMembersByTargetId = new Map<string, string[]>();

	for (const row of groupMemberRows) {
		if (row.studentLastName == null || row.studentFirstName == null) {
			continue;
		}

		const formattedName = formatStudentName(
			row.studentLastName,
			row.studentFirstName,
		);
		if (formattedName.length === 0) {
			continue;
		}
		const names = groupMembersByTargetId.get(row.targetId) ?? [];
		names.push(formattedName);
		groupMembersByTargetId.set(row.targetId, names);
	}

	return { targets, groupMembersByTargetId };
}

// `db` is a test seam only (ADR 0007 rules 13–14): never pass a handle at runtime —
// Kysely instances are not serializable and Next.js throws on the cache key.
export async function loadGradeTargets(
	{ gridId }: { gridId: string },
	{ db = defaultDb }: { db?: Kysely<Database> } = {},
): Promise<GradeTarget[]> {
	"use cache";
	cacheTags(...gradeTargetsCacheTags({ gridId }));
	cacheLife("roster");

	const { targets, groupMembersByTargetId } = await loadGradeTargetsFromDb(db, {
		gridId,
	});

	return targets.map((target) => {
		if (target.kind === "group") {
			const displayLabel = target.groupName ?? target.id;
			const memberNames = groupMembersByTargetId.get(target.id) ?? [];
			const searchKeys = Array.from(
				new Set(
					[displayLabel, ...memberNames]
						.map(normalizeSearchValue)
						.filter((value) => value.length > 0),
				),
			);

			return {
				id: target.id,
				kind: "group",
				groupName: displayLabel,
				displayLabel,
				slug: toTargetSlug(displayLabel),
				memberNames,
				searchKeys,
			};
		}

		const displayLabel =
			target.studentLastName != null && target.studentFirstName != null
				? formatStudentName(target.studentLastName, target.studentFirstName)
				: target.id;
		const searchKeys = [normalizeSearchValue(displayLabel)].filter(
			(value) => value.length > 0,
		);

		return {
			id: target.id,
			kind: "individual",
			studentName: displayLabel,
			displayLabel,
			slug: toTargetSlug(displayLabel),
			memberNames: [],
			searchKeys,
		};
	});
}
