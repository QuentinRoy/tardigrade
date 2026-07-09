"use client";

import { Stack } from "@mantine/core";
import type { ReactElement } from "react";
import CriterionGradeRow from "#criteria/CriterionGradeRow.tsx";
import type {
	AssessedCriterion,
	AssessmentCriterionValue,
} from "#criteria/types.ts";

type CriterionAssessmentSectionProps = {
	savedCriteria: AssessedCriterion[];
	criteria: AssessedCriterion[];
	pendingByIndex: Record<number, number>;
	disabled: boolean;
	onAssess: (index: number, assessment: AssessmentCriterionValue) => void;
};

export default function CriterionGradeList({
	savedCriteria,
	criteria,
	pendingByIndex,
	disabled,
	onAssess,
}: CriterionAssessmentSectionProps): ReactElement {
	const handleAssessment = (
		index: number,
		assessment: AssessmentCriterionValue,
	) => onAssess(index, assessment);

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
						onAssess={(assessment) => handleAssessment(index, assessment)}
					/>
				);
			})}
		</Stack>
	);
}
