import "server-only";
import type { Selectable } from "kysely";
import { customAlphabet } from "nanoid";
import { cacheLife } from "next/cache";
import { invalidateGridCreate } from "#db/cacheInvalidation.ts";
import { cacheTags, gridCacheTag, gridListCacheTag } from "#db/cacheTags.ts";
import type { Database } from "#db/generated/database.ts";
import { database } from "#db/kysely.ts";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const createGridPublicId = () => `g-${nanoid()}`;

type GridRow = Pick<Selectable<Database["grid"]>, "id" | "name">;

export type GridSummary = GridRow & { slug: string };

function normalizeSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function toGridSlug(nameOrSlug: string): string {
	const normalized = normalizeSlug(nameOrSlug);
	if (normalized.length === 0) {
		throw new Error("Grid name must contain at least one letter or number.");
	}
	if (normalized.length > 64) {
		throw new Error("Grid slug must be 64 characters or fewer.");
	}
	return normalized;
}

function toGridSummary(row: GridRow): GridSummary {
	return { id: row.id, slug: toGridSlug(row.name), name: row.name };
}

export async function loadGrids(): Promise<GridSummary[]> {
	"use cache";
	cacheTags(gridListCacheTag());
	cacheLife("directory");

	const rows = await database
		.selectFrom("grid")
		.select(["id", "name"])
		.orderBy("name", "asc")
		.execute();

	return rows.map(toGridSummary);
}

async function loadGridCached(
	publicId: string,
): Promise<GridSummary | undefined> {
	"use cache";
	cacheTags(gridListCacheTag(), gridCacheTag(publicId));
	cacheLife("directory");

	const row = await database
		.selectFrom("grid")
		.select(["id", "name"])
		.where("id", "=", publicId)
		.executeTakeFirst();

	if (row == null) {
		return undefined;
	}

	return toGridSummary(row);
}

export async function loadGridByPublicId(
	publicId: string,
	options: { required: true },
): Promise<GridSummary>;
export async function loadGridByPublicId(
	publicId: string,
	options?: { required?: false },
): Promise<GridSummary | undefined>;
export async function loadGridByPublicId(
	publicId: string,
	{ required = false }: { required?: boolean } = {},
): Promise<GridSummary | undefined> {
	const grid = await loadGridCached(publicId);
	if (grid == null && required) {
		throw new Error(`Unexpected: grid not found: ${publicId}`);
	}
	return grid;
}

export async function createGrid(input: {
	name: string;
}): Promise<GridSummary> {
	const name = input.name.trim();
	if (name.length === 0) {
		throw new Error("Grid name is required.");
	}

	let inserted: GridRow | undefined;

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const publicId = createGridPublicId();

		try {
			inserted = await database
				.insertInto("grid")
				.values({ id: publicId, name })
				.returning(["id", "name"])
				.executeTakeFirstOrThrow();
			break;
		} catch (error) {
			if (
				typeof error !== "object" ||
				error == null ||
				!("code" in error) ||
				error.code !== "23505"
			) {
				throw error;
			}
		}
	}

	if (inserted == null) {
		throw new Error("Unable to create a unique grid id.");
	}

	invalidateGridCreate({ gridId: inserted.id });

	return toGridSummary(inserted);
}
