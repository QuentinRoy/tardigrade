"use client";

import { Box, Group, Text, Tooltip } from "@mantine/core";
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
					{questionId}
				</Text>
				<Box component="span" c="dimmed" display="inline-flex">
					<IconInfoCircle size={14} />
				</Box>
			</Group>
		</Tooltip>
	);
}
