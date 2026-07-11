import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import CosmeticSlugReplacement from "#app-shell/CosmeticSlugReplacement.tsx";
import { loadGradeTargets } from "#grade-targets/gradeTargets.ts";

type GradeTargetScopedLayoutProps = {
	children: ReactNode;
	params: Promise<{ projectId: string; targetId: string }>;
};

// Segment index of `targetId` in `/projects/{id}/{slug}/grades/{targetId}/{targetSlug}/...`.
const TARGET_ID_SEGMENT_INDEX = 5;

export default async function GradeTargetScopedLayout({
	children,
	params,
}: GradeTargetScopedLayoutProps) {
	const { projectId, targetId } = await params;
	// Shares `loadGradeTargets`' cache entry with the page below it — this does
	// not re-query the database.
	const targets = await loadGradeTargets({ projectId });
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
