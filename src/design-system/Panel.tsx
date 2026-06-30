import { Paper, type PaperProps } from "@mantine/core";
import type { ReactElement, ReactNode } from "react";

type PanelProps = PaperProps & { children: ReactNode };

/** Bordered content surface — the house default for grouping related controls. */
export default function Panel(props: PanelProps): ReactElement {
	return <Paper withBorder p="md" {...props} />;
}
