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
// unscoped load would collide keys in `membersByTargetId`.
export async function loadGradeTargetsFromDb(
	db: Kysely<Database>,
	{ gridId }: { gridId: string },
) {
	const gridRowIdQuery = db
		.selectFrom("grid")
		.select("rowId")
		.where("id", "=", gridId);

	const [targets, memberRows] = await Promise.all([
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.gridRowId", "in", gridRowIdQuery)
			.select(["gradeTarget.id as id", "gradeTarget.name as name"])
			// Creation order, not id order: `id` is a per-grid text ordinal
			// (`t-9` sorts after `t-12` lexicographically), so `rowId` (assigned
			// in insertion order) is the only column that sorts correctly.
			.orderBy("gradeTarget.rowId", "asc")
			.execute(),
		// Membership for every target (individual and group alike). A target's
		// individual-vs-group shape is derived from name + this member count,
		// not read from a column.
		db
			.selectFrom("gradeTarget")
			.where("gradeTarget.gridRowId", "in", gridRowIdQuery)
			.innerJoin(
				"gradeTargetStudent",
				"gradeTargetStudent.gradeTargetRowId",
				"gradeTarget.rowId",
			)
			.innerJoin("student", "student.rowId", "gradeTargetStudent.studentRowId")
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

	const membersByTargetId = new Map<string, string[]>();

	for (const row of memberRows) {
		const formattedName = formatStudentName(
			row.studentLastName,
			row.studentFirstName,
		);
		if (formattedName.length === 0) {
			continue;
		}
		const names = membersByTargetId.get(row.targetId) ?? [];
		names.push(formattedName);
		membersByTargetId.set(row.targetId, names);
	}

	return { targets, membersByTargetId };
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

	const { targets, membersByTargetId } = await loadGradeTargetsFromDb(db, {
		gridId,
	});

	return targets.map((target) => {
		const members = membersByTargetId.get(target.id) ?? [];

		// Every target has at least one member (a write-boundary guarantee, ADR
		// 0014). A memberless target is a broken invariant, not a target to
		// label with its opaque id — fail loudly rather than render it.
		if (members.length === 0) {
			throw new Error(
				`Grade target ${target.id} has no members. Every grade target must ` +
					"have at least one student; this row indicates corrupted data.",
			);
		}

		// Name-OR-multimember rule: a target is a Group when it has a name or
		// more than one member, and an Individual only when it has exactly one
		// member and no name.
		const isGroup = target.name != null || members.length > 1;

		if (isGroup) {
			// Group label: the Group Name, falling back to the joined member
			// names when unnamed (an unnamed multi-member target), and never to
			// the opaque id (members are guaranteed non-empty above).
			const displayLabel = target.name ?? members.join(", ");
			const searchKeys = Array.from(
				new Set(
					[displayLabel, ...members]
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
				memberNames: members,
				searchKeys,
			};
		}

		// Individual: exactly one member, no name. Its label is that student's
		// formatted name.
		const displayLabel = members[0] ?? target.id;
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
