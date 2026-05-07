import React from "react";

import "../styles/globals.css";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { SaveErrorsProvider } from "../src/SaveErrorsContext";
import { SaveErrorsDisplay } from "../src/SaveErrorsDisplay";

export const metadata = {
  title: "Grading Grid",
  description: "Simple grading helper for rubric-based evaluation",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

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
