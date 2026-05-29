import type { ReactNode } from "react";

import "../styles/globals.css";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { SaveErrorsDisplay } from "@/shared/SaveErrorsDisplay";
import { SaveErrorsProvider } from "@/shared/SaveErrorsProvider";

export const metadata = {
	title: "Assessment",
	description: "Simple assessment helper for rubric-based evaluation",
};

type RootLayoutProps = { children: ReactNode };

export default function RootLayout({ children }: RootLayoutProps) {
	return (
		<html lang="en">
			<body>
				<AppRouterCacheProvider>
					<SaveErrorsProvider>
						{children}
						<SaveErrorsDisplay />
					</SaveErrorsProvider>
				</AppRouterCacheProvider>
			</body>
		</html>
	);
}
