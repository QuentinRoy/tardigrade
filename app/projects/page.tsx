import {
	Alert,
	Box,
	Button,
	Container,
	List,
	ListItemButton,
	ListItemText,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { redirect } from "next/navigation";
import { toCreateProjectErrorMessage } from "#projects/createProjectErrorMessage.ts";
import { projectDashboardPath } from "#projects/projectPaths.ts";
import { createProject, loadProjects } from "#projects/projects.ts";
import AppShell from "#ui/AppShell.tsx";

function isNextRedirectError(error: unknown): boolean {
	if (typeof error !== "object" || error == null || !("digest" in error)) {
		return false;
	}

	const digest = error.digest;
	return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type ProjectsPageProps = { searchParams: Promise<{ error?: string }> };

export default async function ProjectsPage({
	searchParams,
}: ProjectsPageProps) {
	const projects = await loadProjects();
	const params = await searchParams;

	async function createProjectAction(formData: FormData): Promise<void> {
		"use server";

		const name = String(formData.get("name") ?? "");

		try {
			const project = await createProject({ name });
			redirect(projectDashboardPath(project.id, project.slug));
		} catch (error) {
			if (isNextRedirectError(error)) {
				throw error;
			}

			const message = toCreateProjectErrorMessage(error);
			redirect(`/projects?error=${encodeURIComponent(message)}`);
		}
	}

	return (
		<AppShell showNavigation={false}>
			<Container component="main" maxWidth="md" sx={{ py: 5 }}>
				<Stack sx={{ gap: 3 }}>
					<Box>
						<Typography component="h1" variant="h3" sx={{ mb: 1 }}>
							Change Project
						</Typography>
						<Typography color="text.secondary">
							Switch to an existing project or create a new one.
						</Typography>
					</Box>

					{params.error != null && params.error.length > 0 && (
						<Alert severity="error">{params.error}</Alert>
					)}

					<Box>
						<Typography component="h2" variant="h5" sx={{ mb: 1 }}>
							Existing projects
						</Typography>
						<List component="nav" aria-label="Project list">
							{projects.map((project) => (
								<ListItemButton
									key={project.id}
									component="a"
									href={projectDashboardPath(project.id, project.slug)}
									sx={{ borderRadius: 1, mb: 1 }}
								>
									<ListItemText primary={project.name} />
								</ListItemButton>
							))}
						</List>
					</Box>

					<Box component="form" action={createProjectAction}>
						<Typography component="h2" variant="h5" sx={{ mb: 1 }}>
							Create new project
						</Typography>
						<Stack sx={{ gap: 1.5 }}>
							<TextField
								name="name"
								label="Project name"
								required
								placeholder="e.g. COMP-2026"
							/>
							<Box>
								<Button type="submit" variant="contained">
									Create and switch
								</Button>
							</Box>
						</Stack>
					</Box>
				</Stack>
			</Container>
		</AppShell>
	);
}
