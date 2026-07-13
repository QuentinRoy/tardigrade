"use client";

import { Badge, Table } from "@mantine/core";
import type { ReactElement } from "react";
import CompletionProgress from "./CompletionProgress.tsx";
import CriterionDetailsTooltip from "./CriterionDetailsTooltip.tsx";
import marksBadgeClasses from "./MarksBadge.module.css";
import RubricDetailsTooltip from "./RubricDetailsTooltip.tsx";
import type { CriterionRow } from "./resultsBuilder.ts";

type CriterionAnalyticsTableProps = { criteria: CriterionRow[] };

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

export default function CriterionAnalyticsTable({
	criteria,
}: CriterionAnalyticsTableProps): ReactElement {
	return (
		<Table.ScrollContainer minWidth={400}>
			<Table withTableBorder fz="sm" aria-label="Analytics">
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Rubric</Table.Th>
						<Table.Th>Criterion</Table.Th>
						<Table.Th ta="center">Average</Table.Th>
						<Table.Th ta="right">Completion</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{criteria.map((criterion) => (
						<Table.Tr key={criterion.criterionId}>
							<Table.Td>
								<RubricDetailsTooltip
									rubricId={criterion.rubricId}
									rubricLabel={criterion.rubricLabel}
								/>
							</Table.Td>
							<Table.Td>
								<CriterionDetailsTooltip
									criterionId={criterion.criterionId}
									details={criterion.details}
								/>
							</Table.Td>
							<Table.Td ta="center">
								<Badge
									variant="light"
									color={badgeColor(criterion.averagePercent)}
									classNames={marksBadgeClasses}
								>
									{formatMarks(criterion.averageMarks)} /{" "}
									{formatMarks(criterion.maxMarks)}
								</Badge>
							</Table.Td>
							<Table.Td>
								<CompletionProgress
									gradedCount={criterion.gradedCount}
									totalCount={criterion.totalCount}
									completionPercent={criterion.completionPercent}
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
