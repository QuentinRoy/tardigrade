import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import AppShell from "#app-shell/AppShell.tsx";
import CosmeticSlugReplacement from "#app-shell/CosmeticSlugReplacement.tsx";
import { loadGridByPublicId } from "#grids/grids.ts";

type GridScopedLayoutProps = {
	children: ReactNode;
	params: Promise<{ gridId: string }>;
};

export default async function GridScopedLayout({
	children,
	params,
}: GridScopedLayoutProps) {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId);
	if (grid == null) notFound();
	return (
		<AppShell showNavigation gridName={grid.name}>
			<CosmeticSlugReplacement idIndex={2} id={grid.id} slug={grid.slug} />
			{children}
		</AppShell>
	);
}
