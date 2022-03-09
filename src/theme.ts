import { createTheme } from "@mui/material/styles"; // it could be your App.tsx file or theme file that is included in your tsconfig.json
import { Theme } from "@mui/material/styles";

// Create a theme instance.
const theme = createTheme();

declare module "@mui/styles/defaultTheme" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface DefaultTheme extends Theme {}
}

export default theme;
