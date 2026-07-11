import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "#app-shell/AppShell.tsx";
import CosmeticSlugReplacement from "#app-shell/CosmeticSlugReplacement.tsx";
import { loadProjectByPublicId } from "#projects/projects.ts";

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
			<CosmeticSlugReplacement
				idIndex={2}
				id={project.id}
				slug={project.slug}
			/>
			{children}
		</AppShell>
	);
}
