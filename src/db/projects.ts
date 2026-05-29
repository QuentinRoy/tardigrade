import "server-only";
import { customAlphabet } from "nanoid";
import { cacheLife, revalidateTag } from "next/cache";
import { CACHE_TAGS, cacheTags, projectCacheTag } from "./cacheTags";
import type { Project } from "./generated/db";
import { db } from "./kysely";

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const createProjectPublicId = () => `p-${nanoid()}`;

type ProjectRow = Pick<Project, "id" | "name">;

export type ProjectSummary = ProjectRow & { slug: string };

function normalizeSlug(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function toProjectSlug(nameOrSlug: string): string {
	const normalized = normalizeSlug(nameOrSlug);
	if (normalized.length === 0) {
		throw new Error("Project name must contain at least one letter or number.");
	}
	if (normalized.length > 64) {
		throw new Error("Project slug must be 64 characters or fewer.");
	}
	return normalized;
}

function toProjectSummary(row: ProjectRow): ProjectSummary {
	return { id: row.id, slug: toProjectSlug(row.name), name: row.name };
}

export async function loadProjects(): Promise<ProjectSummary[]> {
	"use cache";
	cacheTags(CACHE_TAGS.projects);
	cacheLife({ revalidate: 60 });

	const rows = await db
		.selectFrom("project")
		.select(["id", "name"])
		.orderBy("name", "asc")
		.execute();

	return rows.map(toProjectSummary);
}

export async function loadProjectByPublicId(
	publicId: string,
): Promise<ProjectSummary | undefined> {
	"use cache";
	cacheTags(CACHE_TAGS.projects, projectCacheTag(publicId));
	cacheLife({ revalidate: 60 });

	const row = await db
		.selectFrom("project")
		.select(["id", "name"])
		.where("id", "=", publicId)
		.executeTakeFirst();

	if (row == null) {
		return undefined;
	}

	return toProjectSummary(row);
}

export async function createProject(input: {
	name: string;
}): Promise<ProjectSummary> {
	const name = input.name.trim();
	if (name.length === 0) {
		throw new Error("Project name is required.");
	}

	let inserted: ProjectRow | undefined;

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const publicId = createProjectPublicId();

		try {
			inserted = await db
				.insertInto("project")
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
		throw new Error("Unable to create a unique project id.");
	}

	revalidateTag("projects", "max");
	revalidateTag(projectCacheTag(inserted.id), "max");

	return toProjectSummary(inserted);
}
