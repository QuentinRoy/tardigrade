"use client";

import Grid from "@mui/material/Grid";
import type { ReactElement } from "react";
import RubricGradeRow from "#rubrics/RubricGradeRow.tsx";
import type { AssessedRubric, AssessmentRubricValue } from "#rubrics/types.ts";

type RubricAssessmentSectionProps = {
	savedRubrics: AssessedRubric[];
	rubrics: AssessedRubric[];
	pendingByIndex: Record<number, number>;
	disabled: boolean;
	onAssess: (index: number, assessment: AssessmentRubricValue) => void;
};

export default function RubricGradeList({
	savedRubrics,
	rubrics,
	pendingByIndex,
	disabled,
	onAssess,
}: RubricAssessmentSectionProps): ReactElement {
	const handleAssessment = (index: number, assessment: AssessmentRubricValue) =>
		onAssess(index, assessment);

	return (
		<Grid container spacing={2} sx={{ mb: 2, alignItems: "center" }}>
			{rubrics.map((rubric, index) => {
				const isPending = (pendingByIndex[index] ?? 0) > 0;
				const savedRubric = savedRubrics[index];

				return (
					<RubricGradeRow
						key={rubric.id}
						rubric={rubric}
						savedRubric={savedRubric}
						isPending={isPending}
						disabled={disabled}
						onAssess={(assessment) => handleAssessment(index, assessment)}
					/>
				);
			})}
		</Grid>
	);
}
