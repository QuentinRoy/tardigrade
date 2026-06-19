import path from "node:path";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
	stories: ["../src/**/*.stories.@(ts|tsx)"],
	addons: ["@storybook/addon-vitest"],
	framework: { name: "@storybook/nextjs-vite", options: {} },
	async viteFinal(viteConfig) {
		const { mergeConfig } = await import("vite");

		return mergeConfig(viteConfig, {
			resolve: {
				alias: {
					dns: path.resolve(process.cwd(), "src/storybook/empty-module.ts"),
					net: path.resolve(process.cwd(), "src/storybook/empty-module.ts"),
					"pg-native": path.resolve(
						process.cwd(),
						"src/storybook/empty-module.ts",
					),
					"server-only": path.resolve(
						process.cwd(),
						"src/storybook/empty-module.ts",
					),
					tls: path.resolve(process.cwd(), "src/storybook/empty-module.ts"),
					"node:dns": path.resolve(
						process.cwd(),
						"src/storybook/empty-module.ts",
					),
					"node:net": path.resolve(
						process.cwd(),
						"src/storybook/empty-module.ts",
					),
					"node:tls": path.resolve(
						process.cwd(),
						"src/storybook/empty-module.ts",
					),
				},
			},
		});
	},
};

export default config;
