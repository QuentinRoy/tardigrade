"use client";

import { Button, Checkbox, Divider, NavLink, Stack, Text } from "@mantine/core";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import {
	changeProjectPath,
	projectAssessmentsPath,
	projectExportQuestionsPath,
	projectExportSubmissionsPath,
	projectImportAssessmentsPath,
	projectImportQuestionsPath,
	projectImportStudentsPath,
	projectOverviewPath,
	projectQuestionsPath,
} from "#projects/projectPaths.ts";
import { useLocalStorage } from "#utils/useLocalStorage.ts";
import { getProjectRouteContext } from "./AppShell.shared.ts";

const EXPORT_STORAGE_KEY = "export-csv-options-v1";

type ExportPersistedOptions = {
	includeRubricAssessment: boolean;
	includeRubricMarks: boolean;
};

const DEFAULT_EXPORT_OPTIONS: ExportPersistedOptions = {
	includeRubricAssessment: true,
	includeRubricMarks: false,
};

function deserializeExportOptions(raw: string): ExportPersistedOptions {
	// JSON.parse is any by default, make sure we validate the shape of the
	// parsed value before returning it.
	const parsed: unknown = JSON.parse(raw);
	if (typeof parsed !== "object" || parsed == null) {
		return DEFAULT_EXPORT_OPTIONS;
	}

	return {
		includeRubricAssessment:
			"includeRubricAssessment" in parsed &&
			parsed.includeRubricAssessment === true,
		includeRubricMarks:
			"includeRubricMarks" in parsed && parsed.includeRubricMarks === true,
	};
}

type NavigationItem = { label: string; href: string };

type NavigationZoneProps = {
	title: string;
	items: NavigationItem[];
	onNavigate?: (() => void) | undefined;
};

function NavigationZone({
	title,
	items,
	onNavigate,
}: NavigationZoneProps): ReactNode {
	return (
		<Stack gap={4} px="md" py="sm">
			<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
				{title}
			</Text>
			<Stack gap={2}>
				{items.map((item) => (
					<NavLink
						key={item.href}
						component={NextLink}
						href={item.href}
						label={item.label}
						{...(onNavigate && { onClick: onNavigate })}
					/>
				))}
			</Stack>
		</Stack>
	);
}

type AppShellDrawerContentProps = {
	projectName: string;
	onDismiss?: () => void;
};

export default function AppShellDrawerContent({
	projectName,
	onDismiss,
}: AppShellDrawerContentProps): ReactNode {
	const pathname = usePathname();
	const projectRouteContext = getProjectRouteContext(pathname);

	const [exportOptions, setExportOptions] =
		useLocalStorage<ExportPersistedOptions>(
			EXPORT_STORAGE_KEY,
			DEFAULT_EXPORT_OPTIONS,
			{ deserialize: deserializeExportOptions },
		);

	const exportHref = useMemo(() => {
		if (projectRouteContext == null) {
			return "";
		}

		const searchParams = new URLSearchParams();

		if (exportOptions.includeRubricAssessment) {
			searchParams.append("include", "rubric-assessment");
		}

		if (exportOptions.includeRubricMarks) {
			searchParams.append("include", "rubric-marks");
		}

		const query = searchParams.toString();
		const basePath = projectExportSubmissionsPath(projectRouteContext);

		return query.length > 0 ? `${basePath}?${query}` : basePath;
	}, [exportOptions, projectRouteContext]);

	if (projectRouteContext == null) {
		return (
			<Stack gap={0}>
				<Text px="md" py="sm">
					Select a project
				</Text>
				<Divider />
			</Stack>
		);
	}

	const assessmentItems: NavigationItem[] = [
		{ label: "Assessments", href: projectAssessmentsPath(projectRouteContext) },
		{
			label: "Rubric overview",
			href: projectOverviewPath(projectRouteContext),
		},
	];

	const managementItems: NavigationItem[] = [
		{
			label: "Manage Questions",
			href: projectQuestionsPath(projectRouteContext),
		},
	];

	const importItems: NavigationItem[] = [
		{
			label: "Import Questions",
			href: projectImportQuestionsPath(projectRouteContext),
		},
		{
			label: "Import Students",
			href: projectImportStudentsPath(projectRouteContext),
		},
		{
			label: "Import Assessments",
			href: projectImportAssessmentsPath(projectRouteContext),
		},
	];

	return (
		<Stack gap={0}>
			<Stack gap={4} px="md" py="sm">
				<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
					Project
				</Text>
				<NavLink
					component={NextLink}
					href={changeProjectPath()}
					label={projectName}
					description="Change project"
					{...(onDismiss && { onClick: onDismiss })}
				/>
			</Stack>
			<Divider />

			<NavigationZone
				title="Assess"
				items={assessmentItems}
				onNavigate={onDismiss}
			/>
			<Divider />
			<NavigationZone
				title="Manage"
				items={managementItems}
				onNavigate={onDismiss}
			/>
			<Divider />
			<NavigationZone
				title="Import"
				items={importItems}
				onNavigate={onDismiss}
			/>
			<Divider />

			<Stack gap="xs" px="md" py="sm">
				<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
					Export Submissions
				</Text>
				<Text size="sm" c="dimmed">
					Configure columns before download.
				</Text>
				<Stack gap="xs">
					<Checkbox
						label="Rubric assessment"
						checked={exportOptions.includeRubricAssessment}
						onChange={(event) => {
							setExportOptions((current) => ({
								...current,
								includeRubricAssessment: event.currentTarget.checked,
							}));
						}}
					/>
					<Checkbox
						label="Rubric marks"
						checked={exportOptions.includeRubricMarks}
						onChange={(event) => {
							setExportOptions((current) => ({
								...current,
								includeRubricMarks: event.currentTarget.checked,
							}));
						}}
					/>
				</Stack>
				<Button
					component={NextLink}
					href={exportHref}
					fullWidth
					{...(onDismiss && { onClick: onDismiss })}
				>
					Download Submissions
				</Button>
			</Stack>
			<Divider />

			<Stack gap="xs" px="md" py="sm">
				<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
					Export Questions
				</Text>
				<Button
					component={NextLink}
					href={projectExportQuestionsPath(projectRouteContext)}
					variant="outline"
					fullWidth
					{...(onDismiss && { onClick: onDismiss })}
				>
					Download Questions
				</Button>
			</Stack>
		</Stack>
	);
}
