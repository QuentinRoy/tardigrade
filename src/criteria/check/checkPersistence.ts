import "server-only";
import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import type {
	CheckCriterion,
	CheckCriterionGradeContent,
} from "./checkDomain.ts";

// Server-only persistence adapters for the Check criterion kind: batched
// definition-subtype upsert, grade-subtype write, and row→config read mapping
// (ADR 0013). `db` is the global client or a caller-supplied transaction.

export type CheckSubtypeRow = {
	criterionRowId: number;
	marks: number;
	falseMarks: number;
};

// Batched upsert of Check definition subtype rows. The coordinator resolves each
// `criterionRowId` and groups by kind before calling this.
export async function upsertCheckSubtypeRowsInDb(
	db: Kysely<Database>,
	rows: CheckSubtypeRow[],
): Promise<void> {
	if (rows.length === 0) {
		return;
	}

	await db
		.insertInto("checkCriterion")
		.values(
			rows.map((row) => ({
				criterionId: row.criterionRowId,
				marks: row.marks,
				falseMarks: row.falseMarks,
			})),
		)
		.onConflict((conflict) =>
			conflict
				.column("criterionId")
				.doUpdateSet((eb) => ({
					marks: eb.ref("excluded.marks"),
					falseMarks: eb.ref("excluded.falseMarks"),
				})),
		)
		.execute();
}

// Writes a Check criterion grade's subtype row. The coordinator upserts the
// parent `criterionGrade` and passes its id, so this never runs before the
// parent row exists.
export async function writeCheckGradeInDb(
	db: Kysely<Database>,
	criterionGradeId: number,
	grade: CheckCriterionGradeContent,
): Promise<void> {
	await db
		.insertInto("checkCriterionGrade")
		.values({ criterionGradeId, passed: grade.passed })
		.onConflict((conflict) =>
			conflict.column("criterionGradeId").doUpdateSet({ passed: grade.passed }),
		)
		.execute();
}

// Maps a loaded criterion row (base fields + the joined Check subtype row) to the
// canonical `CheckCriterion` config. The exhaustive `toCriterion` dispatcher
// delegates its `check` branch here.
export function toCheckCriterion(data: {
	id: string;
	description: string | null;
	label: string | null;
	checkCriterion: { marks: number; falseMarks: number } | null;
}): CheckCriterion {
	if (data.checkCriterion == null) {
		throw new Error(
			`Criterion Subtype Invariant violation: missing checkCriterion row for criterion ${data.id}.`,
		);
	}

	return {
		id: data.id,
		description: data.description ?? undefined,
		label: data.label ?? undefined,
		kind: "check",
		marks: data.checkCriterion.marks,
		falseMarks: data.checkCriterion.falseMarks,
	};
}
