import { Group, Paper, Progress, Stack, Text, Title } from "@mantine/core";
import type { ReactElement } from "react";
import type { AssessmentCompletionSummary } from "./types.ts";

type GlobalAssessmentSummaryProps = { progress: AssessmentCompletionSummary };

type MetricCardProps = {
	title: string;
	helper: string;
	completed: number;
	total: number;
};

function MetricCard({
	title,
	helper,
	completed,
	total,
}: MetricCardProps): ReactElement {
	const safeCompleted = Math.max(0, Math.min(completed, total));
	const percent = total > 0 ? (safeCompleted / total) * 100 : 0;

	return (
		<Paper
			withBorder
			p="md"
			flex="1 1 220px"
			miw={{ base: "100%", sm: 220 }}
			// Group the metric under its title so it has a single accessible name
			// (assistive tech and tests can target "Submissions assessed" etc.).
			role="group"
			aria-label={title}
		>
			<Stack gap="xs">
				<Text fw={600} size="sm">
					{title}
				</Text>
				<Title order={2}>
					{safeCompleted}&nbsp;/&nbsp;{total}
				</Title>
				<Progress value={percent} size="md" />
				<Text size="xs" c="dimmed">
					{helper}
				</Text>
			</Stack>
		</Paper>
	);
}

export default function GlobalAssessmentSummary({
	progress,
}: GlobalAssessmentSummaryProps): ReactElement {
	return (
		<Group gap="sm" wrap="wrap" align="stretch">
			<MetricCard
				title="Criteria assessed"
				helper="Saved criterion assessments across all submissions"
				completed={progress.criteria.completed}
				total={progress.criteria.total}
			/>
			<MetricCard
				title="Rubrics assessed"
				helper="Fully assessed across all submissions"
				completed={progress.rubrics.completed}
				total={progress.rubrics.total}
			/>
			<MetricCard
				title="Submissions assessed"
				helper="Fully assessed across all rubrics"
				completed={progress.submissions.completed}
				total={progress.submissions.total}
			/>
		</Group>
	);
}
