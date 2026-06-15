import { NextRequest, NextResponse } from "next/server";
import { verifySession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { getKpis, getFunnel, getTrend, getRealtime } from "@/lib/ga";
import { enforceIp } from "@/lib/ratelimit";
import { getIp, handleRouteError } from "@/lib/request";

export const runtime = "nodejs";
export const revalidate = 300;

const LIMITS = [{ limit: 60, windowSec: 60 }];

export async function GET(req: NextRequest) {
  try {
    if (!verifySession(req.cookies.get(ADMIN_COOKIE)?.value)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await enforceIp("admin_metrics", getIp(req), LIMITS);
    const range = Number(req.nextUrl.searchParams.get("range") ?? "7");
    const safeRange = Math.min(Math.max(range, 1), 90);
    const kind = req.nextUrl.searchParams.get("kind") ?? "all";
    if (kind === "realtime") {
      const data = await getRealtime();
      return NextResponse.json(data);
    }
    const [kpis, funnel, trend] = await Promise.all([
      getKpis(safeRange),
      getFunnel(safeRange),
      getTrend(safeRange, "gift_created"),
    ]);
    return NextResponse.json({ range: safeRange, kpis, funnel, trend });
  } catch (e) {
    return handleRouteError("/api/admin/metrics GET", e);
  }
}
