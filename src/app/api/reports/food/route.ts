import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { monthlyFoodReport, foodReportCsv } from "@/services/reports";
import { csvDisposition } from "@/lib/csv";
import { mn } from "@/lib/i18n/mn";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const q = req.nextUrl.searchParams;
  const year = Number(q.get("year"));
  const month = Number(q.get("month"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return new Response(mn.errors.validation, { status: 400 });
  }
  try {
    const r = await monthlyFoodReport(actor, q.get("classId") ?? "", year, month);
    return new Response(foodReportCsv(r), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": csvDisposition(`food-${r.className}-${r.year}-${r.month}`) },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
