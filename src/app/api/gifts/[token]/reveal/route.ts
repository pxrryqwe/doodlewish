import { NextRequest, NextResponse } from "next/server";
import { getReveal } from "@/lib/serverStore";
import { tokenSchema } from "@/lib/schemas";
import { enforceIp } from "@/lib/ratelimit";
import { getIp, handleRouteError } from "@/lib/request";

export const runtime = "nodejs";

const LIMITS = [
  { limit: 240, windowSec: 60 },
  { limit: 2400, windowSec: 3600 },
];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    await enforceIp("reveal", getIp(req), LIMITS);
    const { token } = await ctx.params;
    if (!tokenSchema.safeParse(token).success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const data = await getReveal(token);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return handleRouteError("/api/gifts/[token]/reveal GET", e);
  }
}
