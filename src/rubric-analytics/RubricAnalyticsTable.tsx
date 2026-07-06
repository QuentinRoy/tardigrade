"use client";

import { Badge, Table } from "@mantine/core";
import type { ReactElement } from "react";
import CompletionProgress from "./CompletionProgress.tsx";
import marksBadgeClasses from "./MarksBadge.module.css";
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

function badgeColor(percent: number | null): string {
	if (percent == null || Number.isNaN(percent)) return "gray";
	if (percent >= 70) return "green";
	if (percent >= 40) return "yellow";
	return "red";
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
					{rubrics.map((rubric) => (
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
								<Badge
									variant="light"
									color={badgeColor(rubric.averagePercent)}
									classNames={marksBadgeClasses}
								>
									{formatMarks(rubric.averageMarks)} /{" "}
									{formatMarks(rubric.maxMarks)}
								</Badge>
							</Table.Td>
							<Table.Td>
								<CompletionProgress
									assessedCount={rubric.assessedCount}
									totalCount={rubric.totalCount}
									completionPercent={rubric.completionPercent}
									alignItems="flex-end"
								/>
							</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
