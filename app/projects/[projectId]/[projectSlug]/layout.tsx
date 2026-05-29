import type { ReactNode } from "react";
import AppShell from "@/shared/AppShell";

type ProjectScopedLayoutProps = { children: ReactNode };

export default function ProjectScopedLayout({
	children,
}: ProjectScopedLayoutProps) {
	return <AppShell showNavigation>{children}</AppShell>;
}
