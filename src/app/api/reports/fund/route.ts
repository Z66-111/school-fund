import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { classFundReport, fundReportCsv } from "@/services/reports";
import { csvDisposition } from "@/lib/csv";
import { AppError } from "@/lib/errors";
import { getT, getLocale } from "@/lib/i18n/server";
import { translateMessage } from "@/lib/i18n";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const classId = req.nextUrl.searchParams.get("classId") ?? "";
  try {
    const r = await classFundReport(actor, classId);
    return new Response(fundReportCsv(r, await getT()), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": csvDisposition(`fund-${r.className}`) },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(translateMessage(e.message, await getLocale()), { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
