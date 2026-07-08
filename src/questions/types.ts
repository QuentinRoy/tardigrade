import type { Criterion } from "#criteria/types.ts";

export type Question = { label?: string | undefined; criteria: Criterion[] };

export type Grid = { [id: string]: Question };
