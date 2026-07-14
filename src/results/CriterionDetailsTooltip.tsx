"use client";

import { Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactElement, ReactNode } from "react";
import type { CriterionDetails } from "./resultsBuilder.ts";

type CriterionDetailsTooltipProps = {
	criterionId: string;
	details: CriterionDetails;
};

function propertyRows(details: CriterionDetails): ReactNode[] {
	if (details.properties.kind === "check") {
		return [
			<Text key="true" size="xs">
				True marks: {details.properties.trueMarks}
			</Text>,
			<Text key="false" size="xs">
				False marks: {details.properties.falseMarks}
			</Text>,
		];
	}

	if (details.properties.kind === "options") {
		return details.properties.marksByLabel.map((entry) => (
			<Text key={entry.label} size="xs">
				{entry.label}: {entry.marks}
			</Text>
		));
	}

	return [
		<Text key="value-range" size="xs">
			Value range: {details.properties.minValue} - {details.properties.maxValue}
		</Text>,
		<Text key="marks-range" size="xs">
			Marks range: {details.properties.minMarks} - {details.properties.maxMarks}
		</Text>,
		<Text key="reversed" size="xs">
			Reversed: {details.properties.reversed ? "yes" : "no"}
		</Text>,
	];
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
					<Text size="xs">Kind: {details.kind}</Text>
					{propertyRows(details)}
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
