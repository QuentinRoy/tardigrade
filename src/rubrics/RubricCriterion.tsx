"use client";

import { Box, Group, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import AssessmentStatus from "./AssessmentStatus.tsx";
import BooleanGradeControl from "./BooleanGradeControl.tsx";
import NumericalGradeControl from "./NumericalGradeControl.tsx";
import OrdinalGradeControl from "./OrdinalGradeControl.tsx";
import { getRubricMaxMarks, getRubricMinMarks, markRubric } from "./rubric.ts";
import type { AssessedRubric, AssessmentRubricValue } from "./types.ts";

type RubricCriterionProps = {
	rubric: AssessedRubric;
	savedRubric?: AssessedRubric | undefined;
	isPending: boolean;
	disabled: boolean;
	onAssess: (assessment: AssessmentRubricValue) => void;
};

export default function RubricCriterion({
	rubric,
	savedRubric,
	isPending,
	disabled,
	onAssess,
}: RubricCriterionProps): ReactElement {
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
		<Group wrap="nowrap" gap="md" py="0" miw={0}>
			<AssessmentStatus
				assessmentStatus={assessmentStatus}
				isSaving={isPending}
			/>
			<Box flex="0 0 auto">{control}</Box>
			<Stack gap={0} miw={0} flex={1}>
				<Text>{displayLabel}</Text>
				{description != null && (
					<Text size="sm" c="dimmed">
						{description}
					</Text>
				)}
			</Stack>
			<Text size="sm" c="dimmed" flex="0 0 auto">
				({currentMarks != null ? currentMarks : "_"}&nbsp;/&nbsp;
				{rubricBound})
			</Text>
		</Group>
	);
}
