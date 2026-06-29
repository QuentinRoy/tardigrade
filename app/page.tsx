import { redirect } from "next/navigation";
import { projectDashboardPath } from "#projects/projectPaths.ts";
import { loadProjects } from "#projects/projects.ts";

export default async function HomePage() {
	const projects = await loadProjects();
	const defaultProject = projects[0];

	if (defaultProject == null) {
		redirect("/projects");
	}

	redirect(
		projectDashboardPath({
			projectId: defaultProject.id,
			projectSlug: defaultProject.slug,
		}),
	);
}
