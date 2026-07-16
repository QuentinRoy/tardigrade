"use client";

import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactElement } from "react";
import type { CriterionDetails } from "#criteria/criterionDetails.ts";
import { getCriterionKindLabel } from "#criteria/getCriterionKindLabel.ts";

type CriterionDetailsTooltipProps = {
	criterionId: string;
	details: CriterionDetails;
};

function PropertyRows(props: CriterionDetails["properties"]): ReactElement {
	if (props.kind === "check") {
		return (
			<>
				<Text key="true" size="xs">
					Yes marks: {props.trueMarks}
				</Text>
				<Text key="false" size="xs">
					No marks: {props.falseMarks}
				</Text>
			</>
		);
	}

	if (props.kind === "options") {
		return (
			<>
				{props.marksByLabel.map((entry) => (
					<Text key={entry.label} size="xs">
						{entry.label}: {entry.marks}
					</Text>
				))}
			</>
		);
	}

	return (
		<>
			<Text key="value-range" size="xs">
				Value range: {props.minValue} - {props.maxValue}
			</Text>
			<Text key="marks-range" size="xs">
				Marks range: {props.minMarks} - {props.maxMarks}
			</Text>
			<Text key="reversed" size="xs">
				Reversed: {props.reversed ? "yes" : "no"}
			</Text>
		</>
	);
}

export default function CriterionDetailsTooltip({
	criterionId,
	details,
}: CriterionDetailsTooltipProps): ReactElement {
	return (
		<Tooltip
			label={
				<Stack gap="xs">
					<Text size="xs" fw={600}>
						{details.label ?? criterionId}
					</Text>
					{details.description != null && details.description.length > 0 && (
						<Text size="xs">{details.description}</Text>
					)}
					<Text size="xs">Kind: {getCriterionKindLabel(details.kind)}</Text>
					<PropertyRows {...details.properties} />
				</Stack>
			}
			position="top"
			multiline
			maw="min(40ch, 90vw)"
			withArrow
			openDelay={120}
		>
			<Group
				component="span"
				wrap="nowrap"
				display="inline-flex"
				style={{ cursor: "help" }}
			>
				<Text component="span" size="sm" td="underline dotted">
					{criterionId}
				</Text>
				<Box component="span" c="dimmed" display="inline-flex">
					<IconInfoCircle size={14} />
				</Box>
			</Group>
		</Tooltip>
	);
}
