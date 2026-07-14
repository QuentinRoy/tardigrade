import {
	Alert,
	Box,
	Button,
	Stack,
	Text,
	TextInput,
	Title,
} from "@mantine/core";
import { redirect } from "next/navigation";
import AppShell from "#app-shell/AppShell.tsx";
import AppNavLink from "#design-system/AppNavLink.tsx";
import AppPage from "#design-system/AppPage.tsx";
import { toCreateGridErrorMessage } from "#grids/createGridErrorMessage.ts";
import { gridDashboardPath } from "#grids/gridPaths.ts";
import { createGrid, loadGrids } from "#grids/grids.ts";

function isNextRedirectError(error: unknown): boolean {
	if (typeof error !== "object" || error == null || !("digest" in error)) {
		return false;
	}

	const digest = error.digest;
	return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

type GridsPageProps = { searchParams: Promise<{ error?: string }> };

export default async function GridsPage({ searchParams }: GridsPageProps) {
	const grids = await loadGrids();
	const params = await searchParams;

	async function createGridAction(formData: FormData): Promise<void> {
		"use server";

		const name = String(formData.get("name") ?? "");

		try {
			const grid = await createGrid({ name });
			redirect(gridDashboardPath({ gridId: grid.id, gridSlug: grid.slug }));
		} catch (error) {
			if (isNextRedirectError(error)) {
				throw error;
			}

			const message = toCreateGridErrorMessage(error);
			redirect(`/grids?error=${encodeURIComponent(message)}`);
		}
	}

	return (
		<AppShell showNavigation={false}>
			<AppPage>
				<Stack gap="lg">
					<Stack gap="xs">
						<Title order={1}>Change Grid</Title>
						<Text c="dimmed">
							Switch to an existing grid or create a new one.
						</Text>
					</Stack>

					{params.error != null && params.error.length > 0 && (
						<Alert color="red" variant="light">
							{params.error}
						</Alert>
					)}

					<Stack gap="xs">
						<Title order={2}>Existing grids</Title>
						<Stack component="nav" aria-label="Grid list" gap="xs">
							{grids.map((grid) => (
								<AppNavLink
									key={grid.id}
									href={gridDashboardPath({
										gridId: grid.id,
										gridSlug: grid.slug,
									})}
									label={grid.name}
								/>
							))}
						</Stack>
					</Stack>

					<Box component="form" action={createGridAction}>
						<Stack gap="sm">
							<Title order={2}>Create new grid</Title>
							<TextInput
								name="name"
								label="Grid name"
								required
								placeholder="e.g. COMP-2026"
							/>
							<Box>
								<Button type="submit">Create and switch</Button>
							</Box>
						</Stack>
					</Box>
				</Stack>
			</AppPage>
		</AppShell>
	);
}
