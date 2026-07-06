import { createTheme } from "@mantine/core";

/**
 * App-wide Mantine theme. Light scheme only (see ADR 0011). Spacing and
 * fontSizes are tuned slightly below Mantine defaults for a compact-leaning
 * density; per-component defaults are refined against the marking view in
 * the assessment-capture migration step.
 */
export const theme = createTheme({});
