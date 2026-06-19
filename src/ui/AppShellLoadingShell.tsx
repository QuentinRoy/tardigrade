"use client";

import type { ReactNode } from "react";
import AppShellTopBar from "./AppShellTopBar.tsx";

type AppShellLoadingShellProps = { showNavigation: boolean };

export default function AppShellLoadingShell({
	showNavigation,
}: AppShellLoadingShellProps): ReactNode {
	return <AppShellTopBar title={showNavigation ? "Project" : "BonPoint"} />;
}
