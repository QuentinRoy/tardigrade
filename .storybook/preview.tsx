import { CssBaseline, createTheme, ThemeProvider } from "@mui/material";
import type { Preview } from "@storybook/nextjs";
import type { ReactElement, ReactNode } from "react";

const theme = createTheme();

function MuiDecorator(Story: () => ReactElement): ReactNode {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Story />
    </ThemeProvider>
  );
}

const preview: Preview = {
  decorators: [MuiDecorator],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
