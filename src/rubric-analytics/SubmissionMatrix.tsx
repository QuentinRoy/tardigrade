import { Badge, Table } from "@mantine/core";
import type { ReactElement } from "react";
import CompletionProgress from "./CompletionProgress.tsx";
import RubricDetailsTooltip from "./RubricDetailsTooltip.tsx";
import type {
	RubricOverviewRow,
	RubricOverviewSubmissionRow,
} from "./rubricOverviewBuilder.ts";

type SubmissionMatrixProps = {
	rubrics: RubricOverviewRow[];
	submissionRows: RubricOverviewSubmissionRow[];
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

export default function SubmissionMatrix({
	rubrics,
	submissionRows,
}: SubmissionMatrixProps): ReactElement {
	return (
		<Table.ScrollContainer minWidth={500}>
			<Table withTableBorder fz="sm" aria-label="Submission matrix">
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Submission</Table.Th>
						{rubrics.map((rubric) => (
							<Table.Th key={rubric.rubricId} ta="center">
								<RubricDetailsTooltip
									rubricId={rubric.rubricId}
									details={rubric.details}
								/>
							</Table.Th>
						))}
						<Table.Th ta="center">Average</Table.Th>
						<Table.Th ta="right">Completion</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{submissionRows.map((submissionRow) => {
						const avgPercent =
							submissionRow.maxMarks > 0
								? (submissionRow.marks / submissionRow.maxMarks) * 100
								: null;

						return (
							<Table.Tr key={submissionRow.submissionId}>
								<Table.Td>{submissionRow.submissionLabel}</Table.Td>
								{submissionRow.rubrics.map((rubricCell) => {
									const cellPercent =
										rubricCell.assessed && rubricCell.maxMarks > 0
											? ((rubricCell.marks ?? 0) / rubricCell.maxMarks) * 100
											: null;

									return (
										<Table.Td key={rubricCell.rubricId} ta="center">
											<Badge
												variant="light"
												color={
													rubricCell.assessed ? badgeColor(cellPercent) : "gray"
												}
											>
												{rubricCell.assessed
													? `${formatMarks(rubricCell.marks)} / ${formatMarks(rubricCell.maxMarks)}`
													: "-"}
											</Badge>
										</Table.Td>
									);
								})}
								<Table.Td ta="center">
									<Badge variant="light" color={badgeColor(avgPercent)}>
										{formatMarks(submissionRow.marks)} /{" "}
										{formatMarks(submissionRow.maxMarks)}
									</Badge>
								</Table.Td>
								<Table.Td ta="right">
									<CompletionProgress
										assessedCount={submissionRow.completedRubrics}
										totalCount={submissionRow.totalRubrics}
										completionPercent={
											submissionRow.totalRubrics > 0
												? (submissionRow.completedRubrics /
														submissionRow.totalRubrics) *
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
