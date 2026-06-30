"use client";

import { Group, Text, Tooltip } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import type { ReactElement } from "react";

type QuestionDetailsTooltipProps = {
	questionId: string;
	questionLabel: string;
};

export default function QuestionDetailsTooltip({
	questionId,
	questionLabel,
}: QuestionDetailsTooltipProps): ReactElement {
	return (
		<Tooltip
			label={<Text size="xs">{questionLabel}</Text>}
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
					{questionId}
				</Text>
				<IconInfoCircle
					size={14}
					style={{ color: "var(--mantine-color-dimmed)" }}
				/>
			</Group>
		</Tooltip>
	);
}
