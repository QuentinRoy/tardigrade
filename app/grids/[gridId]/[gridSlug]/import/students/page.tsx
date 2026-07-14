import { Suspense } from "react";
import { loadGridByPublicId } from "#grids/grids.ts";
import StudentsImportForm from "#imports/students/StudentsImportForm.tsx";
import { studentsImportAction } from "#imports/students/studentsImportAction.ts";

type GridImportStudentsPageProps = {
	params: Promise<{ gridId: string; gridSlug: string }>;
};

export default async function GridImportStudentsPage({
	params,
}: GridImportStudentsPageProps) {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId, { required: true });

	return (
		<Suspense>
			<StudentsImportForm action={studentsImportAction.bind(null, grid.id)} />
		</Suspense>
	);
}
