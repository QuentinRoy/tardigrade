"use client";

import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { type ReactNode, Suspense, useState } from "react";
import AppShellLoadingShell from "./AppShellLoadingShell";
import AppShellNavigationShell from "./AppShellNavigationShell";

type AppShellProps =
  | { showNavigation: true; projectName: string; children: ReactNode }
  | { showNavigation?: false; children: ReactNode };

export default function AppShell(props: AppShellProps) {
  const { children } = props;
  const showNavigation = props.showNavigation ?? false;
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Suspense
        fallback={<AppShellLoadingShell showNavigation={showNavigation} />}
      >
        <AppShellNavigationShell
          {...(props.showNavigation
            ? { showNavigation: true, projectName: props.projectName }
            : { showNavigation: false })}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
          onCloseDrawer={() => setDrawerOpen(false)}
        />
      </Suspense>

			<Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
				{/* This is used as spacer */}
				<Toolbar />
				{children}
			</Box>
		</Box>
	);
}
