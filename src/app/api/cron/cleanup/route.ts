import { NextRequest, NextResponse } from "next/server";
import { cleanupExpired } from "@/lib/serverStore";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-cron-secret") ?? req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await cleanupExpired();
  return NextResponse.json({ ok: true, ...result });
}
