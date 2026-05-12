import { stringify } from "csv-stringify/sync";
import { createSubmissionExport } from "@/db/submissionExport";
import { parseExportOptions } from "@/export/submissionExportCsv";

export async function GET(request: Request): Promise<Response> {
  const searchParams = new URL(request.url).searchParams;

  let options;
  try {
    options = parseExportOptions(searchParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return Response.json({ error: message }, { status: 400 });
  }

  const exportData = await createSubmissionExport(options);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        controller.enqueue(encoder.encode(stringify([exportData.headers])));

        for await (const row of exportData.rows) {
          controller.enqueue(encoder.encode(stringify([row])));
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const filename = `submission-assessments-${y}${m}${d}.csv`;

  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
