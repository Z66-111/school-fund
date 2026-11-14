import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { monthlyFoodReport, foodReportCsv } from "@/services/reports";
import { csvDisposition } from "@/lib/csv";
import { getT, getLocale } from "@/lib/i18n/server";
import { mn } from "@/lib/i18n/mn";
import { translateMessage } from "@/lib/i18n";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const q = req.nextUrl.searchParams;
  const year = Number(q.get("year"));
  const month = Number(q.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return new Response(translateMessage(mn.errors.validation, await getLocale()), { status: 400 });
  }
  try {
    const kind = q.get("kind") === "DAYCARE" ? "DAYCARE" : "FOOD";
    const r = await monthlyFoodReport(actor, q.get("classId") ?? "", year, month, kind);
    return new Response(foodReportCsv(r, await getT()), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": csvDisposition(`${kind === "DAYCARE" ? "daycare" : "food"}-${r.className}-${r.year}-${r.month}`) },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(translateMessage(e.message, await getLocale()), { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
