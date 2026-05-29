"use client";

import { Toolbar } from "@mui/material";
import Drawer from "@mui/material/Drawer";
import { usePathname } from "next/navigation";
import { type ReactNode, useId } from "react";
import { projectDashboardPath } from "@/projects/projectPaths";
import {
	APP_SHELL_DRAWER_WIDTH,
	getProjectRouteContext,
} from "./AppShell.shared";
import AppShellDrawerContent from "./AppShellDrawerContent";
import AppShellTopBar from "./AppShellTopBar";

type AppShellNavigationShellProps =
	| {
			showNavigation: true;
			projectName: string;
			drawerOpen: boolean;
			onOpenDrawer: () => void;
			onCloseDrawer: () => void;
	  }
	| {
			showNavigation: false;
			drawerOpen: boolean;
			onOpenDrawer: () => void;
			onCloseDrawer: () => void;
	  };

export default function AppShellNavigationShell(
	props: AppShellNavigationShellProps,
): ReactNode {
	const { showNavigation, drawerOpen, onOpenDrawer, onCloseDrawer } = props;
	const pathname = usePathname();
	const projectRouteContext = getProjectRouteContext(pathname);
	const title = props.showNavigation ? props.projectName : "BonPoint";
	const drawerId = useId();

	return (
		<>
			<AppShellTopBar
				title={title}
				titleHref={
					showNavigation && projectRouteContext != null
						? projectDashboardPath(
								projectRouteContext.projectId,
								projectRouteContext.projectSlug,
							)
						: undefined
				}
				drawerOpen={showNavigation && drawerOpen}
				onToggleDrawer={
					showNavigation
						? () => (drawerOpen ? onCloseDrawer() : onOpenDrawer())
						: undefined
				}
				drawerId={showNavigation ? drawerId : undefined}
			/>

			{props.showNavigation && (
				// Intentionally use non-swipeable Drawer.
				// Swipe gestures conflict with browser navigation
				// on iPad/Safari and opening via the hamburger
				// button is the intended interaction path.
				<Drawer
					anchor="left"
					open={drawerOpen}
					onClose={onCloseDrawer}
					slotProps={{
						paper: {
							"aria-label": "Project navigation",
							id: drawerId,
							sx: { width: APP_SHELL_DRAWER_WIDTH, boxSizing: "border-box" },
						},
					}}
				>
					{/* This is used as spacer */}
					<Toolbar />
					<AppShellDrawerContent
						projectRouteContext={projectRouteContext}
						projectName={props.projectName}
						onDismiss={onCloseDrawer}
					/>
				</Drawer>
			)}
		</>
	);
}
