import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import type { Preview } from "@storybook/nextjs-vite";
import type { ReactElement, ReactNode } from "react";
import { theme as mantineTheme } from "../src/design-system/theme.ts";

function MantineDecorator(Story: () => ReactElement): ReactNode {
	return (
		<MantineProvider theme={mantineTheme} defaultColorScheme="light">
			<Story />
		</MantineProvider>
	);
}

const preview: Preview = {
	decorators: [MantineDecorator],
	parameters: {
		nextjs: { appDirectory: true },
		controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
	},
};

export default preview;
