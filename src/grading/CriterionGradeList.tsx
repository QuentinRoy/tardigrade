"use client";

import { Stack } from "@mantine/core";
import type { ReactElement } from "react";
import CriterionGradeRow from "#criteria/CriterionGradeRow.tsx";
import type { CriterionGrade, GradedCriterion } from "#criteria/types.ts";

type CriterionGradeSectionProps = {
	savedCriteria: GradedCriterion[];
	criteria: GradedCriterion[];
	pendingByIndex: Record<number, number>;
	disabled: boolean;
	onGrade: (index: number, grade: CriterionGrade) => void;
};

export default function CriterionGradeList({
	savedCriteria,
	criteria,
	pendingByIndex,
	disabled,
	onGrade,
}: CriterionGradeSectionProps): ReactElement {
	const handleGrade = (index: number, grade: CriterionGrade) =>
		onGrade(index, grade);

	return (
		<Stack gap="xs" mb="md">
			{criteria.map((criterion, index) => {
				const isPending = (pendingByIndex[index] ?? 0) > 0;
				const savedCriterion = savedCriteria[index];

				return (
					<CriterionGradeRow
						key={criterion.id}
						criterion={criterion}
						savedCriterion={savedCriterion}
						isPending={isPending}
						disabled={disabled}
						onGrade={(grade) => handleGrade(index, grade)}
					/>
				);
			})}
		</Stack>
	);
}
