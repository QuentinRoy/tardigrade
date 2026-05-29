import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { loadProjectByPublicId } from "@/db/projects";
import AppShell from "@/shared/AppShell";

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
