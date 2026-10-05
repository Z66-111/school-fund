import { NextRequest } from "next/server";
import { getActor } from "@/lib/session";
import { monthlyFoodReport, foodReportCsv } from "@/services/reports";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return new Response("Unauthorized", { status: 401 });
  const q = req.nextUrl.searchParams;
  try {
    const r = await monthlyFoodReport(actor, q.get("classId") ?? "", Number(q.get("year")), Number(q.get("month")));
    return new Response(foodReportCsv(r), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="food-${r.className}-${r.year}-${r.month}.csv"` },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response(e.message, { status: e.code === "FORBIDDEN" ? 403 : 400 });
    throw e;
  }
}
