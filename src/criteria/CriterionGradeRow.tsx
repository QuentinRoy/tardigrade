"use client";

import { Box, Group, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import CheckGradeControl from "./CheckGradeControl.tsx";
import {
	getCriterionMaxMarks,
	getCriterionMinMarks,
	markCriterion,
} from "./criterion.ts";
import GradeStatus from "./GradeStatus.tsx";
import NumberGradeControl from "./NumberGradeControl.tsx";
import OptionsGradeControl from "./OptionsGradeControl.tsx";
import type { CriterionGrade, GradedCriterion } from "./types.ts";

type CriterionGradeRowProps = {
	criterion: GradedCriterion;
	savedCriterion?: GradedCriterion | undefined;
	isPending: boolean;
	disabled: boolean;
	onGrade: (grade: CriterionGrade) => void;
};

export default function CriterionGradeRow({
	criterion,
	savedCriterion,
	isPending,
	disabled,
	onGrade,
}: CriterionGradeRowProps): ReactElement {
	const { description, grade, id, label, kind } = criterion;
	const savedGrade = savedCriterion?.grade;
	const displayLabel = label ?? id;
	const maxMarks = getCriterionMaxMarks(criterion);
	const criterionBound =
		maxMarks === 0 ? getCriterionMinMarks(criterion) : maxMarks;
	const currentMarks = grade != null ? markCriterion(criterion) : null;
	const displayGrade = isPending ? savedGrade : grade;
	const gradeStatus = displayGrade != null ? "graded" : "ungraded";

	let control: ReactElement;

	if (kind === "options") {
		control = (
			<OptionsGradeControl
				value={grade?.selectedLabel}
				marks={criterion.marks}
				disabled={disabled}
				onGrade={(selectedLabel) =>
					onGrade({ criterionId: id, kind: "options", selectedLabel })
				}
			/>
		);
	} else if (kind === "number") {
		control = (
			<NumberGradeControl
				value={grade?.value}
				minValue={criterion.minValue}
				maxValue={criterion.maxValue}
				disabled={disabled}
				onGrade={(value) => onGrade({ criterionId: id, kind: "number", value })}
			/>
		);
	} else {
		control = (
			<CheckGradeControl
				value={grade?.passed}
				marks={criterion.marks}
				falseMarks={criterion.falseMarks}
				disabled={disabled}
				onGrade={(passed) =>
					onGrade({ criterionId: id, kind: "check", passed })
				}
			/>
		);
	}

	return (
		<Group wrap="nowrap" gap="md" py="0" miw={0}>
			<GradeStatus gradeStatus={gradeStatus} isSaving={isPending} />
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
