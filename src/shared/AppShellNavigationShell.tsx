"use client";

import { Toolbar } from "@mui/material";
import Box from "@mui/material/Box";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import { usePathname } from "next/navigation";
import { type ReactNode, useId } from "react";
import { projectDashboardPath } from "@/projects/routes";
import {
  APP_SHELL_DRAWER_WIDTH,
  displayProjectName,
  getProjectRouteContext,
} from "./AppShell.shared";
import AppShellDrawerContent from "./AppShellDrawerContent";
import AppShellTopBar from "./AppShellTopBar";

type AppShellNavigationShellProps = {
  showNavigation: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  topSpace?: number;
};

export default function AppShellNavigationShell({
  showNavigation,
  drawerOpen,
  onOpenDrawer,
  onCloseDrawer,
  topSpace = 0,
}: AppShellNavigationShellProps): ReactNode {
  const pathname = usePathname();
  const projectRouteContext = getProjectRouteContext(pathname);
  const title =
    showNavigation && projectRouteContext != null
      ? displayProjectName(projectRouteContext.projectSlug)
      : "BonPoint";
  const drawerId = useId();
  const iOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

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

      {showNavigation && (
        <SwipeableDrawer
          anchor="left"
          open={drawerOpen}
          onOpen={onOpenDrawer}
          onClose={onCloseDrawer}
          disableBackdropTransition={!iOS}
          disableDiscovery={iOS}
          disableSwipeToOpen={iOS}
          ModalProps={{ keepMounted: true }}
          slotProps={{
            paper: {
              "aria-label": "Project navigation",
              id: drawerId,
              sx: (theme) => ({
                width: APP_SHELL_DRAWER_WIDTH,
                boxSizing: "border-box",
              }),
            },
          }}
        >
          {/* This is used as spacer */}
          <Toolbar />
          <AppShellDrawerContent
            projectRouteContext={projectRouteContext}
            onDismiss={onCloseDrawer}
          />
        </SwipeableDrawer>
      )}
    </>
  );
}
