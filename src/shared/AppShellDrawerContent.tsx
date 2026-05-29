"use client";

import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
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
} from "@/projects/routes";
import { useLocalStorage } from "@/utils/useLocalStorage";
import {
	displayProjectName,
	type ProjectRouteContext,
} from "./AppShell.shared";

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
	const parsed = JSON.parse(raw) as unknown;
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
	onNavigate?: () => void;
};

function NavigationZone({
	title,
	items,
	onNavigate,
}: NavigationZoneProps): ReactNode {
	return (
		<Box sx={{ px: 2, py: 1.5 }}>
			<Typography component="p" variant="overline" color="text.secondary">
				{title}
			</Typography>
			<List disablePadding>
				{items.map((item) => (
					<ListItemButton
						key={item.href}
						component={NextLink}
						href={item.href}
						onClick={onNavigate}
						sx={{ borderRadius: 1 }}
					>
						<ListItemText primary={item.label} />
					</ListItemButton>
				))}
			</List>
		</Box>
	);
}

type AppShellDrawerContentProps = {
	projectRouteContext: ProjectRouteContext | null;
	onDismiss?: () => void;
};

export default function AppShellDrawerContent({
	projectRouteContext,
	onDismiss,
}: AppShellDrawerContentProps): ReactNode {
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
		const basePath = projectExportSubmissionsPath(
			projectRouteContext.projectId,
			projectRouteContext.projectSlug,
		);

		return query.length > 0 ? `${basePath}?${query}` : basePath;
	}, [exportOptions, projectRouteContext]);

	if (projectRouteContext == null) {
		return (
			<>
				<Toolbar>
					<Typography component="p" variant="subtitle1" sx={{ flexGrow: 1 }}>
						Select a project
					</Typography>
					<IconButton
						edge="end"
						onClick={onDismiss}
						aria-label="Close navigation drawer"
					>
						<CloseIcon />
					</IconButton>
				</Toolbar>
				<Divider />
			</>
		);
	}

	const assessmentItems: NavigationItem[] = [
		{
			label: "Assessments",
			href: projectAssessmentsPath(
				projectRouteContext.projectId,
				projectRouteContext.projectSlug,
			),
		},
		{
			label: "Rubric overview",
			href: projectOverviewPath(
				projectRouteContext.projectId,
				projectRouteContext.projectSlug,
			),
		},
	];

	const managementItems: NavigationItem[] = [
		{
			label: "Manage Questions",
			href: projectQuestionsPath(
				projectRouteContext.projectId,
				projectRouteContext.projectSlug,
			),
		},
	];

	const importItems: NavigationItem[] = [
		{
			label: "Import Questions",
			href: projectImportQuestionsPath(
				projectRouteContext.projectId,
				projectRouteContext.projectSlug,
			),
		},
		{
			label: "Import Students",
			href: projectImportStudentsPath(
				projectRouteContext.projectId,
				projectRouteContext.projectSlug,
			),
		},
		{
			label: "Import Assessments",
			href: projectImportAssessmentsPath(
				projectRouteContext.projectId,
				projectRouteContext.projectSlug,
			),
		},
	];

	return (
		<>
			<Stack divider={<Divider flexItem />}>
				<Box sx={{ px: 2, py: 1.5 }}>
					<Typography component="p" variant="overline" color="text.secondary">
						Project
					</Typography>
					<List disablePadding>
						<ListItemButton
							component={NextLink}
							href={changeProjectPath()}
							onClick={onDismiss}
							sx={{ borderRadius: 1 }}
						>
							<ListItemText
								primary={displayProjectName(projectRouteContext.projectSlug)}
								secondary="Change project"
							/>
						</ListItemButton>
					</List>
				</Box>
				<NavigationZone
					title="Assess"
					items={assessmentItems}
					onNavigate={onDismiss}
				/>
				<NavigationZone
					title="Manage"
					items={managementItems}
					onNavigate={onDismiss}
				/>
				<NavigationZone
					title="Import"
					items={importItems}
					onNavigate={onDismiss}
				/>
				<Box sx={{ px: 2, py: 1.5 }}>
					<Typography component="p" variant="overline" color="text.secondary">
						Export Submissions
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						Configure columns before download.
					</Typography>
					<FormGroup sx={{ mb: 2 }}>
						<FormControlLabel
							control={
								<Checkbox
									checked={exportOptions.includeRubricAssessment}
									onChange={(event) => {
										setExportOptions((current) => ({
											...current,
											includeRubricAssessment: event.target.checked,
										}));
									}}
								/>
							}
							label="Rubric assessment"
						/>
						<FormControlLabel
							control={
								<Checkbox
									checked={exportOptions.includeRubricMarks}
									onChange={(event) => {
										setExportOptions((current) => ({
											...current,
											includeRubricMarks: event.target.checked,
										}));
									}}
								/>
							}
							label="Rubric marks"
						/>
					</FormGroup>
					<Button
						component={NextLink}
						href={exportHref}
						variant="contained"
						fullWidth
						onClick={onDismiss}
					>
						Download Submissions
					</Button>
				</Box>
				<Box sx={{ px: 2, py: 1.5 }}>
					<Typography component="p" variant="overline" color="text.secondary">
						Export Questions
					</Typography>
					<Button
						component={NextLink}
						href={projectExportQuestionsPath(
							projectRouteContext.projectId,
							projectRouteContext.projectSlug,
						)}
						variant="outlined"
						fullWidth
						onClick={onDismiss}
					>
						Download Questions
					</Button>
				</Box>
			</Stack>
		</>
	);
}
