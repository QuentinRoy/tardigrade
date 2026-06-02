import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { loadProjectByPublicId } from "#projects/projects.ts";
import AppShell from "#ui/AppShell.tsx";

type ProjectScopedLayoutProps = {
	children: ReactNode;
	params: Promise<{ projectId: string }>;
};

export default async function ProjectScopedLayout({
	children,
	params,
}: ProjectScopedLayoutProps) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId);
	if (project == null) notFound();
	return (
		<AppShell showNavigation projectName={project.name}>
			{children}
		</AppShell>
	);
}
