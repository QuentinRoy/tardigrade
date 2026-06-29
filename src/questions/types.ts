import type { Rubric } from "#rubrics/types.ts";

export type Question = { label?: string | undefined; rubrics: Rubric[] };

export type Grid = { [id: string]: Question };
