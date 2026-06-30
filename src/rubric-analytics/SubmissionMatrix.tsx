import { alpha, Box, Table, Text } from "@mantine/core";
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

function severityColor(percent: number | null): string {
	if (percent == null || Number.isNaN(percent)) {
		return "hsl(220 8% 60%)";
	}

	const clamped = Math.max(0, Math.min(percent, 100));
	const hue = Math.max(0, Math.min(120, clamped * 1.2));
	return `hsl(${hue} 70% 42%)`;
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
					{submissionRows.map((submissionRow) => (
						<Table.Tr key={submissionRow.submissionId}>
							<Table.Td>{submissionRow.submissionLabel}</Table.Td>
							{submissionRow.rubrics.map((rubricCell) => {
								const color = rubricCell.assessed
									? severityColor(
											rubricCell.maxMarks > 0
												? ((rubricCell.marks ?? 0) / rubricCell.maxMarks) * 100
												: 0,
										)
									: "hsl(220 8% 60%)";

								return (
									<Table.Td key={rubricCell.rubricId} ta="center">
										<Box
											display="inline-flex"
											px={6}
											py={2}
											bdrs="sm"
											miw={64}
											style={{
												justifyContent: "center",
												color,
												backgroundColor: alpha(
													color,
													rubricCell.assessed ? 0.12 : 0.08,
												),
											}}
										>
											<Text size="xs" style={{ whiteSpace: "nowrap" }}>
												{rubricCell.assessed
													? `${formatMarks(rubricCell.marks)} / ${formatMarks(rubricCell.maxMarks)}`
													: "-"}
											</Text>
										</Box>
									</Table.Td>
								);
							})}
							<Table.Td ta="center" style={{ whiteSpace: "nowrap" }}>
								{(() => {
									const color = severityColor(submissionRow.averagePercent);
									return (
										<Box
											display="inline-flex"
											px={8}
											py={4}
											bdrs="sm"
											style={{
												alignItems: "center",
												backgroundColor: alpha(color, 0.1),
											}}
										>
											<Text size="sm" style={{ color, whiteSpace: "nowrap" }}>
												{formatMarks(submissionRow.marks)} /{" "}
												{formatMarks(submissionRow.maxMarks)}
											</Text>
										</Box>
									);
								})()}
							</Table.Td>
							<Table.Td ta="right" miw={180}>
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
					))}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
