"use client";

import { Badge, Table } from "@mantine/core";
import type { ReactElement } from "react";
import CompletionProgress from "./CompletionProgress.tsx";
import CriterionDetailsTooltip from "./CriterionDetailsTooltip.tsx";
import marksBadgeClasses from "./MarksBadge.module.css";
import type { CriterionRow, GradeTargetRow } from "./resultsBuilder.ts";

type GradeMatrixProps = {
	criteria: CriterionRow[];
	gradeTargetRows: GradeTargetRow[];
};

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

export default function GradeMatrix({
	criteria,
	gradeTargetRows,
}: GradeMatrixProps): ReactElement {
	return (
		<Table.ScrollContainer minWidth={500}>
			<Table withTableBorder fz="sm" aria-label="Grades">
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Name</Table.Th>
						{criteria.map((criterion) => (
							<Table.Th key={criterion.criterionId} ta="center">
								<CriterionDetailsTooltip
									criterionId={criterion.criterionId}
									details={criterion.details}
								/>
							</Table.Th>
						))}
						<Table.Th ta="center">Total</Table.Th>
						<Table.Th ta="right">Completion</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{gradeTargetRows.map((gradeTargetRow) => {
						const totalPercent =
							gradeTargetRow.maxMarks > 0
								? (gradeTargetRow.marks / gradeTargetRow.maxMarks) * 100
								: null;

						return (
							<Table.Tr key={gradeTargetRow.gradeTargetId}>
								<Table.Td>{gradeTargetRow.label}</Table.Td>
								{gradeTargetRow.criteria.map((cell) => {
									// Leave ungraded criteria blank rather than showing a
									// placeholder badge — an empty cell reads as "no mark yet".
									if (!cell.graded) {
										return <Table.Td key={cell.criterionId} />;
									}

									const cellPercent =
										cell.maxMarks > 0
											? ((cell.marks ?? 0) / cell.maxMarks) * 100
											: null;

									return (
										<Table.Td key={cell.criterionId} ta="center">
											<Badge
												variant="light"
												color={badgeColor(cellPercent)}
												classNames={marksBadgeClasses}
											>
												{`${formatMarks(cell.marks)} / ${formatMarks(cell.maxMarks)}`}
											</Badge>
										</Table.Td>
									);
								})}
								<Table.Td ta="center">
									<Badge
										variant="light"
										color={badgeColor(totalPercent)}
										classNames={marksBadgeClasses}
									>
										{formatMarks(gradeTargetRow.marks)} /{" "}
										{formatMarks(gradeTargetRow.maxMarks)}
									</Badge>
								</Table.Td>
								<Table.Td ta="right">
									<CompletionProgress
										gradedCount={gradeTargetRow.completedCriteria}
										totalCount={gradeTargetRow.totalCriteria}
										completionPercent={
											gradeTargetRow.totalCriteria > 0
												? (gradeTargetRow.completedCriteria /
														gradeTargetRow.totalCriteria) *
													100
												: 0
										}
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
