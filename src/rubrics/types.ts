import type { Criterion } from "#criteria/types.ts";

export type Rubric = { label?: string | undefined; criteria: Criterion[] };

export type RubricsById = { [id: string]: Rubric };
