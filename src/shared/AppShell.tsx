"use client";

import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import { type ReactNode, Suspense, useState } from "react";
import AppShellLoadingShell from "./AppShellLoadingShell";
import AppShellNavigationShell from "./AppShellNavigationShell";

type AppShellProps = {
  children: ReactNode;
  showNavigation?: boolean;
};

export default function AppShell({
  children,
  showNavigation = true,
}: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Suspense
        fallback={<AppShellLoadingShell showNavigation={showNavigation} />}
      >
        <AppShellNavigationShell
          showNavigation={showNavigation}
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
