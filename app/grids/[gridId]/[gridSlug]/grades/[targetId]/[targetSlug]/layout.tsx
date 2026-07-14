import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import CosmeticSlugReplacement from "#app-shell/CosmeticSlugReplacement.tsx";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";

type GradeTargetScopedLayoutProps = {
	children: ReactNode;
	params: Promise<{ gridId: string; targetId: string }>;
};

// Segment index of `targetId` in `/grids/{id}/{slug}/grades/{targetId}/{targetSlug}/...`.
const TARGET_ID_SEGMENT_INDEX = 5;

export default async function GradeTargetScopedLayout({
	children,
	params,
}: GradeTargetScopedLayoutProps) {
	const { gridId, targetId } = await params;
	// Shares `loadGradeTargets`' cache entry with the page below it — this does
	// not re-query the database.
	const targets = await loadGradeTargets({ gridId });
	const target = targets.find((candidate) => candidate.id === targetId);
	if (target == null) notFound();

	return (
		<>
			<CosmeticSlugReplacement
				idIndex={TARGET_ID_SEGMENT_INDEX}
				id={target.id}
				slug={target.slug ?? target.id}
			/>
			{children}
		</>
	);
}
