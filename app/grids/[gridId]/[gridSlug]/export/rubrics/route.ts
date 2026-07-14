import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { buildDatedFilename } from "#export/exportFilename.ts";
import { exportRubricsToYaml } from "#export/rubricsExport.ts";
import { loadGridByPublicId } from "#grids/grids.ts";
import { loadRubricsById } from "#rubrics/rubrics.ts";
import { createLogger } from "#utils/logger.ts";

const logger = createLogger("export");

type RouteParams = { params: Promise<{ gridId: string; gridSlug: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
	const { gridId } = await params;
	const grid = await loadGridByPublicId(gridId);

	if (grid == null) {
		return NextResponse.json({ error: "Grid not found" }, { status: 404 });
	}

	try {
		const rubrics = await loadRubricsById({ gridId: grid.id });
		const yaml = exportRubricsToYaml(rubrics);

		const filename = buildDatedFilename({
			baseName: `rubrics-export-${grid.slug}`,
			extension: "yaml",
		});

		return new NextResponse(yaml, {
			status: 200,
			headers: {
				"Content-Type": "application/yaml; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Failed to export rubrics");
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to export rubrics",
			},
			{ status: 500 },
		);
	}
}
