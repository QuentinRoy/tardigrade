import {
	Alert,
	Box,
	Button,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { redirect } from "next/navigation";
import AppShell from "#app-shell/AppShell.tsx";
import AppNavLink from "#design-system/AppNavLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import { toCreateProjectErrorMessage } from "#projects/createProjectErrorMessage.ts";
import { projectDashboardPath } from "#projects/projectPaths.ts";
import { createProject, loadProjects } from "#projects/projects.ts";

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
			redirect(
				projectDashboardPath({
					projectId: project.id,
					projectSlug: project.slug,
				}),
			);
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
			<AppPage>
				<Stack gap="lg">
					<Stack gap="xs">
						<Title order={1}>Change Project</Title>
						<Text c="dimmed">
							Switch to an existing project or create a new one.
						</Text>
					</Stack>

					{params.error != null && params.error.length > 0 && (
						<Alert color="red" variant="light">
							{params.error}
						</Alert>
					)}

					<Stack gap="xs">
						<Title order={2}>Existing projects</Title>
						<Stack component="nav" aria-label="Project list" gap="xs">
							{projects.map((project) => (
								<AppNavLink
									key={project.id}
									href={projectDashboardPath({
										projectId: project.id,
										projectSlug: project.slug,
									})}
									label={project.name}
								/>
							))}
						</Stack>
					</Stack>

					<Box component="form" action={createProjectAction}>
						<Stack gap="sm">
							<Title order={2}>Create new project</Title>
							<TextInput
								name="name"
								label="Project name"
								required
								placeholder="e.g. COMP-2026"
							/>
							<Box>
								<Button type="submit">Create and switch</Button>
							</Box>
						</Stack>
					</Box>
				</Stack>
			</AppPage>
		</AppShell>
	);
}
