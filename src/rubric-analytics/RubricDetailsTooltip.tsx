"use client";

import { Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactElement, ReactNode } from "react";
import type { RubricOverviewPopupDetails } from "./rubricOverviewBuilder.ts";

type RubricDetailsTooltipProps = {
	rubricId: string;
	details: RubricOverviewPopupDetails;
};

function propertyRows(details: RubricOverviewPopupDetails): ReactNode[] {
	if (details.properties.type === "boolean") {
		return [
			<Text key="true" size="xs">
				True marks: {details.properties.trueMarks}
			</Text>,
			<Text key="false" size="xs">
				False marks: {details.properties.falseMarks}
			</Text>,
		];
	}

	if (details.properties.type === "ordinal") {
		return details.properties.marksByLabel.map((entry) => (
			<Text key={entry.label} size="xs">
				{entry.label}: {entry.marks}
			</Text>
		));
	}

	return [
		<Text key="score-range" size="xs">
			Score range: {details.properties.minScore} - {details.properties.maxScore}
		</Text>,
		<Text key="marks-range" size="xs">
			Marks range: {details.properties.minMarks} - {details.properties.maxMarks}
		</Text>,
		<Text key="reversed" size="xs">
			Reversed: {details.properties.reversed ? "yes" : "no"}
		</Text>,
	];
}

export default function RubricDetailsTooltip({
	rubricId,
	details,
}: RubricDetailsTooltipProps): ReactElement {
	return (
		<Tooltip
			label={
				<Stack gap="xs">
					<Text size="xs" fw={600}>
						{details.label ?? rubricId}
					</Text>
					{details.description != null && details.description.length > 0 && (
						<Text size="xs">{details.description}</Text>
					)}
					<Text size="xs">Type: {details.type}</Text>
					{propertyRows(details)}
				</Stack>
			}
			position="right-start"
			withArrow
			openDelay={120}
		>
			<Group
				component="span"
				gap={4}
				wrap="nowrap"
				display="inline-flex"
				style={{ cursor: "help" }}
			>
				<Text component="span" size="sm" td="underline dotted">
					{rubricId}
				</Text>
				<IconInfoCircle
					size={14}
					style={{ color: "var(--mantine-color-dimmed)" }}
				/>
			</Group>
		</Tooltip>
	);
}
