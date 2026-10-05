import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { classFundReport, fundReportCsv } from "@/services/reports";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const classId = req.nextUrl.searchParams.get("classId") ?? "";
  try {
    const r = await classFundReport(actor, classId);
    return new Response(fundReportCsv(r), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="fund-${r.className}.csv"` },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
