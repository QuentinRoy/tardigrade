import { redirect } from "next/navigation";
import { loadProjects } from "@/db/projects";
import { projectDashboardPath } from "@/projects/routes";

export default async function HomePage() {
	const projects = await loadProjects();
	const defaultProject = projects[0];

	if (defaultProject == null) {
		redirect("/projects");
	}

	redirect(projectDashboardPath(defaultProject.id, defaultProject.slug));
}
