"use client";

import { Button, Checkbox, Divider, NavLink, Stack, Text } from "@mantine/core";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo } from "react";
import {
	changeGridPath,
	gridExportGradesPath,
	gridExportRubricsPath,
	gridGradesPath,
	gridImportGradesPath,
	gridImportRubricsPath,
	gridImportStudentsPath,
	gridResultsPath,
	gridRubricsPath,
} from "#grids/gridPaths.ts";
import { useLocalStorage } from "#utils/useLocalStorage.ts";
import { getGridRouteContext } from "./AppShell.shared.ts";

const EXPORT_STORAGE_KEY = "export-csv-options-v1";

type ExportPersistedOptions = {
	includeCriterionGrade: boolean;
	includeCriterionMarks: boolean;
};

const DEFAULT_EXPORT_OPTIONS: ExportPersistedOptions = {
	includeCriterionGrade: true,
	includeCriterionMarks: false,
};

function deserializeExportOptions(raw: string): ExportPersistedOptions {
	// JSON.parse is any by default, make sure we validate the shape of the
	// parsed value before returning it.
	const parsed: unknown = JSON.parse(raw);
	if (typeof parsed !== "object" || parsed == null) {
		return DEFAULT_EXPORT_OPTIONS;
	}

	return {
		includeCriterionGrade:
			"includeCriterionGrade" in parsed &&
			parsed.includeCriterionGrade === true,
		includeCriterionMarks:
			"includeCriterionMarks" in parsed &&
			parsed.includeCriterionMarks === true,
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
		<Stack gap="xs" px="md" py="sm">
			<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
				{title}
			</Text>
			<Stack gap="xs">
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

type AppShellDrawerContentProps = { gridName: string; onDismiss?: () => void };

export default function AppShellDrawerContent({
	gridName,
	onDismiss,
}: AppShellDrawerContentProps): ReactNode {
	const pathname = usePathname();
	const gridRouteContext = getGridRouteContext(pathname);

	const [exportOptions, setExportOptions] =
		useLocalStorage<ExportPersistedOptions>(
			EXPORT_STORAGE_KEY,
			DEFAULT_EXPORT_OPTIONS,
			{ deserialize: deserializeExportOptions },
		);

	const exportHref = useMemo(() => {
		if (gridRouteContext == null) {
			return "";
		}

		const searchParams = new URLSearchParams();

		if (exportOptions.includeCriterionGrade) {
			searchParams.append("include", "criterion-grade");
		}

		if (exportOptions.includeCriterionMarks) {
			searchParams.append("include", "criterion-marks");
		}

		const query = searchParams.toString();
		const basePath = gridExportGradesPath(gridRouteContext);

		return query.length > 0 ? `${basePath}?${query}` : basePath;
	}, [exportOptions, gridRouteContext]);

	if (gridRouteContext == null) {
		return (
			<Stack gap={0}>
				<Text px="md" py="sm">
					Select a grid
				</Text>
				<Divider />
			</Stack>
		);
	}

	const gradeItems: NavigationItem[] = [
		{ label: "Grading", href: gridGradesPath(gridRouteContext) },
		{ label: "Results", href: gridResultsPath(gridRouteContext) },
	];

	const managementItems: NavigationItem[] = [
		{ label: "Manage Rubrics", href: gridRubricsPath(gridRouteContext) },
	];

	const importItems: NavigationItem[] = [
		{ label: "Import Rubrics", href: gridImportRubricsPath(gridRouteContext) },
		{
			label: "Import Students",
			href: gridImportStudentsPath(gridRouteContext),
		},
		{ label: "Import Grades", href: gridImportGradesPath(gridRouteContext) },
	];

	return (
		<Stack gap={0}>
			<Stack gap="xs" px="md" py="sm">
				<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
					Grid
				</Text>
				<NavLink
					component={NextLink}
					href={changeGridPath()}
					label={gridName}
					description="Change grid"
					{...(onDismiss && { onClick: onDismiss })}
				/>
			</Stack>
			<Divider />

			<NavigationZone title="Grade" items={gradeItems} onNavigate={onDismiss} />
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
					Export Grades
				</Text>
				<Text size="sm" c="dimmed">
					Configure columns before download.
				</Text>
				<Stack gap="xs">
					<Checkbox
						label="Criterion grade"
						checked={exportOptions.includeCriterionGrade}
						onChange={(event) => {
							setExportOptions((current) => ({
								...current,
								includeCriterionGrade: event.currentTarget.checked,
							}));
						}}
					/>
					<Checkbox
						label="Criterion marks"
						checked={exportOptions.includeCriterionMarks}
						onChange={(event) => {
							setExportOptions((current) => ({
								...current,
								includeCriterionMarks: event.currentTarget.checked,
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
					Download Grades
				</Button>
			</Stack>
			<Divider />

			<Stack gap="xs" px="md" py="sm">
				<Text size="xs" tt="uppercase" c="dimmed" fw={600}>
					Export Rubrics
				</Text>
				<Button
					component={NextLink}
					href={gridExportRubricsPath(gridRouteContext)}
					variant="outline"
					fullWidth
					{...(onDismiss && { onClick: onDismiss })}
				>
					Download Rubrics
				</Button>
			</Stack>
		</Stack>
	);
}
