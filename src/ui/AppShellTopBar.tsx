"use client";

import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import type { ReactNode } from "react";

type AppShellTopBarProps = {
	title: string;
	titleHref?: string | undefined;
	drawerOpen?: boolean | undefined;
	onToggleDrawer?: (() => void) | undefined;
	drawerId?: string | undefined;
};

export default function AppShellTopBar({
	title,
	titleHref,
	drawerOpen = false,
	onToggleDrawer,
	drawerId,
}: AppShellTopBarProps): ReactNode {
	return (
		<AppBar
			position="fixed"
			sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
		>
			<Toolbar>
				<Box
					sx={{
						width: 48,
						flexShrink: 0,
						display: "flex",
						alignItems: "center",
					}}
				>
					{onToggleDrawer != null ? (
						<IconButton
							color="inherit"
							edge="start"
							onClick={onToggleDrawer}
							aria-label={
								drawerOpen
									? "Close navigation drawer"
									: "Open navigation drawer"
							}
							aria-expanded={drawerOpen}
							aria-controls={drawerId}
						>
							{drawerOpen ? <CloseIcon /> : <MenuIcon />}
						</IconButton>
					) : null}
				</Box>

				<Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center" }}>
					{titleHref != null ? (
						<Typography
							component={NextLink}
							href={titleHref}
							variant="h6"
							sx={{ color: "inherit", textDecoration: "none" }}
						>
							{title}
						</Typography>
					) : (
						<Typography variant="h6" sx={{ color: "inherit" }}>
							{title}
						</Typography>
					)}
				</Box>

				<Box sx={{ width: 48, flexShrink: 0 }} aria-hidden />
			</Toolbar>
		</AppBar>
	);
}
