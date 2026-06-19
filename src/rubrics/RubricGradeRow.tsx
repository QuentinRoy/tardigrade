"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import type { AssessmentRubricValue } from "#assessments/types.ts";
import BooleanGradeControl from "./BooleanGradeControl.tsx";
import NumericalGradeControl from "./NumericalGradeControl.tsx";
import OrdinalGradeControl from "./OrdinalGradeControl.tsx";
import RubricStatusMarker from "./RubricStatusMarker.tsx";
import { getRubricMaxMarks, getRubricMinMarks, markRubric } from "./rubric.ts";
import type { AssessedRubric } from "./types.ts";

type RubricGradeRowProps = {
	rubric: AssessedRubric;
	savedRubric?: AssessedRubric | undefined;
	isPending: boolean;
	disabled: boolean;
	onAssess: (assessment: AssessmentRubricValue) => void;
};

export default function RubricGradeRow({
	rubric,
	savedRubric,
	isPending,
	disabled,
	onAssess,
}: RubricGradeRowProps): ReactElement {
	const { description, assessment, id, label, type } = rubric;
	const savedAssessment = savedRubric?.assessment;
	const displayLabel = label ?? id;
	const maxMarks = getRubricMaxMarks(rubric);
	const rubricBound = maxMarks === 0 ? getRubricMinMarks(rubric) : maxMarks;
	const currentMarks = assessment != null ? markRubric(rubric) : null;
	const displayAssessment = isPending ? savedAssessment : assessment;
	const assessmentStatus =
		displayAssessment != null ? "assessed" : "unassessed";

	let control: ReactElement;

	if (type === "ordinal") {
		control = (
			<OrdinalGradeControl
				value={assessment?.selectedLabel}
				marks={rubric.marks}
				disabled={disabled}
				onAssess={(selectedLabel) =>
					onAssess({ rubricId: id, type: "ordinal", selectedLabel })
				}
			/>
		);
	} else if (type === "numerical") {
		control = (
			<NumericalGradeControl
				value={assessment?.score}
				minScore={rubric.minScore}
				maxScore={rubric.maxScore}
				disabled={disabled}
				onAssess={(score) =>
					onAssess({ rubricId: id, type: "numerical", score })
				}
			/>
		);
	} else {
		control = (
			<BooleanGradeControl
				value={assessment?.passed}
				disabled={disabled}
				onAssess={(passed) =>
					onAssess({ rubricId: id, type: "boolean", passed })
				}
			/>
		);
	}

	return (
		<Grid size={12}>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 2,
					minWidth: 0,
					py: 0.5,
				}}
			>
				<RubricStatusMarker
					assessmentStatus={assessmentStatus}
					isSaving={isPending}
				/>
				<Box
					sx={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}
				>
					{control}
				</Box>
				<Box sx={{ minWidth: 0 }}>
					{displayLabel}
					{description != null && (
						<Typography variant="body2" color="textSecondary">
							{description}
						</Typography>
					)}
				</Box>
				<Box sx={{ ml: "auto", textAlign: "right", flexShrink: 0 }}>
					<Typography variant="body2" color="textSecondary">
						({currentMarks != null ? currentMarks : "_"}&nbsp;/&nbsp;
						{rubricBound})
					</Typography>
				</Box>
			</Box>
		</Grid>
	);
}
