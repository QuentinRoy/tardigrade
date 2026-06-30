import { alpha, Box, Table, Text } from "@mantine/core";
import type { ReactElement } from "react";
import CompletionProgress from "./CompletionProgress.tsx";
import QuestionDetailsTooltip from "./QuestionDetailsTooltip.tsx";
import RubricDetailsTooltip from "./RubricDetailsTooltip.tsx";
import type { RubricOverviewRow } from "./rubricOverviewBuilder.ts";

type RubricAnalyticsTableProps = { rubrics: RubricOverviewRow[] };

function formatMarks(value: number | null): string {
	if (value == null || Number.isNaN(value)) {
		return "-";
	}

	return value.toFixed(1).replace(/\.0$/, "");
}

function severityColor(percent: number | null): string {
	if (percent == null || Number.isNaN(percent)) {
		return "hsl(220 8% 60%)";
	}

	const clamped = Math.max(0, Math.min(percent, 100));
	const hue = Math.max(0, Math.min(120, clamped * 1.2));
	return `hsl(${hue} 70% 42%)`;
}

export default function RubricAnalyticsTable({
	rubrics,
}: RubricAnalyticsTableProps): ReactElement {
	return (
		<Table.ScrollContainer minWidth={400}>
			<Table withTableBorder fz="sm" aria-label="Rubric analytics">
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Question</Table.Th>
						<Table.Th>Rubric</Table.Th>
						<Table.Th ta="center">Average</Table.Th>
						<Table.Th ta="right">Completion</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{rubrics.map((rubric) => {
						const color = severityColor(rubric.averagePercent);

						return (
							<Table.Tr key={rubric.rubricId}>
								<Table.Td>
									<QuestionDetailsTooltip
										questionId={rubric.questionId}
										questionLabel={rubric.questionLabel}
									/>
								</Table.Td>
								<Table.Td>
									<RubricDetailsTooltip
										rubricId={rubric.rubricId}
										details={rubric.details}
									/>
								</Table.Td>
								<Table.Td ta="center">
									<Box
										display="inline-flex"
										px={8}
										py={4}
										bdrs="sm"
										style={{
											alignItems: "start",
											backgroundColor: alpha(color, 0.1),
										}}
									>
										<Text size="sm" style={{ color, whiteSpace: "nowrap" }}>
											{formatMarks(rubric.averageMarks)} /{" "}
											{formatMarks(rubric.maxMarks)}
										</Text>
									</Box>
								</Table.Td>
								<Table.Td miw={180}>
									<CompletionProgress
										assessedCount={rubric.assessedCount}
										totalCount={rubric.totalCount}
										completionPercent={rubric.completionPercent}
										alignItems="flex-end"
									/>
								</Table.Td>
							</Table.Tr>
						);
					})}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
