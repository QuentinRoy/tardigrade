"use client";

import { Box, Group, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import AssessmentStatus from "./AssessmentStatus.tsx";
import CheckGradeControl from "./CheckGradeControl.tsx";
import {
	getCriterionMaxMarks,
	getCriterionMinMarks,
	markCriterion,
} from "./criterion.ts";
import NumberGradeControl from "./NumberGradeControl.tsx";
import OptionsGradeControl from "./OptionsGradeControl.tsx";
import type { AssessedCriterion, AssessmentCriterionValue } from "./types.ts";

type CriterionGradeRowProps = {
	criterion: AssessedCriterion;
	savedCriterion?: AssessedCriterion | undefined;
	isPending: boolean;
	disabled: boolean;
	onAssess: (assessment: AssessmentCriterionValue) => void;
};

export default function CriterionGradeRow({
	criterion,
	savedCriterion,
	isPending,
	disabled,
	onAssess,
}: CriterionGradeRowProps): ReactElement {
	const { description, assessment, id, label, kind } = criterion;
	const savedAssessment = savedCriterion?.assessment;
	const displayLabel = label ?? id;
	const maxMarks = getCriterionMaxMarks(criterion);
	const criterionBound =
		maxMarks === 0 ? getCriterionMinMarks(criterion) : maxMarks;
	const currentMarks = assessment != null ? markCriterion(criterion) : null;
	const displayAssessment = isPending ? savedAssessment : assessment;
	const assessmentStatus =
		displayAssessment != null ? "assessed" : "unassessed";

	let control: ReactElement;

	if (kind === "options") {
		control = (
			<OptionsGradeControl
				value={assessment?.selectedLabel}
				marks={criterion.marks}
				disabled={disabled}
				onAssess={(selectedLabel) =>
					onAssess({ criterionId: id, kind: "options", selectedLabel })
				}
			/>
		);
	} else if (kind === "number") {
		control = (
			<NumberGradeControl
				value={assessment?.score}
				minScore={criterion.minScore}
				maxScore={criterion.maxScore}
				disabled={disabled}
				onAssess={(score) =>
					onAssess({ criterionId: id, kind: "number", score })
				}
			/>
		);
	} else {
		control = (
			<CheckGradeControl
				value={assessment?.passed}
				disabled={disabled}
				onAssess={(passed) =>
					onAssess({ criterionId: id, kind: "check", passed })
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
				{criterionBound})
			</Text>
		</Group>
	);
}
