import { NextRequest, NextResponse } from "next/server";
import { removeFrame } from "@/lib/serverStore";
import { tokenSchema, uuidSchema } from "@/lib/schemas";
import { enforceIp, enforceIdentity } from "@/lib/ratelimit";
import { getIp, handleRouteError } from "@/lib/request";

export const runtime = "nodejs";

const IP_LIMITS = [
  { limit: 120, windowSec: 60 },
  { limit: 600, windowSec: 3600 },
];
const TOKEN_LIMITS = [{ limit: 500, windowSec: 3600 }];

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ token: string; frameId: string }> }
) {
  try {
    const { token, frameId } = await ctx.params;
    if (!tokenSchema.safeParse(token).success || !uuidSchema.safeParse(frameId).success) {
      return NextResponse.json({ error: "Invalid params" }, { status: 400 });
    }
    await enforceIp("delete_frame", getIp(req), IP_LIMITS);
    await enforceIdentity("delete_frame", token, TOKEN_LIMITS);
    const ok = await removeFrame(token, frameId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError("/api/gifts/[token]/frames/[frameId] DELETE", e);
  }
}
