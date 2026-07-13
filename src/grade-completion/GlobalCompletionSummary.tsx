import { Group, Paper, Progress, Stack, Text, Title } from "@mantine/core";
import type { ReactElement } from "react";
import type { GradeCompletionSummary } from "./types.ts";

type GlobalCompletionSummaryProps = { completion: GradeCompletionSummary };

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
			// (assistive tech and tests can target "Students and groups graded" etc.).
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

export default function GlobalCompletionSummary({
	completion,
}: GlobalCompletionSummaryProps): ReactElement {
	return (
		<Group gap="sm" wrap="wrap" align="stretch">
			<MetricCard
				title="Criteria graded"
				helper="Saved criterion grades across all students and groups"
				completed={completion.criteria.completed}
				total={completion.criteria.total}
			/>
			<MetricCard
				title="Rubrics graded"
				helper="Fully graded across all students and groups"
				completed={completion.rubrics.completed}
				total={completion.rubrics.total}
			/>
			<MetricCard
				title="Students and groups graded"
				helper="Fully graded across all rubrics"
				completed={completion.gradeTargets.completed}
				total={completion.gradeTargets.total}
			/>
		</Group>
	);
}
