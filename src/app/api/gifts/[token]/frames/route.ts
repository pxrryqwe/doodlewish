import { NextRequest, NextResponse } from "next/server";
import { addFrame } from "@/lib/serverStore";
import { addFrameSchema, tokenSchema } from "@/lib/schemas";
import { enforceIp, enforceIdentity } from "@/lib/ratelimit";
import { getIp, handleRouteError, parseBody } from "@/lib/request";

export const runtime = "nodejs";
export const maxDuration = 30;

const IP_LIMITS = [
  { limit: 60, windowSec: 60 },
  { limit: 300, windowSec: 3600 },
];
const IDENTITY_LIMITS = [{ limit: 30, windowSec: 3600 }];

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await ctx.params;
    if (!tokenSchema.safeParse(token).success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const parsed = await parseBody(req, addFrameSchema);
    if (!parsed.ok) return parsed.response;
    await enforceIp("add_frame", getIp(req), IP_LIMITS);
    await enforceIdentity(
      "add_frame",
      parsed.data.contributorId,
      IDENTITY_LIMITS
    );
    const result = await addFrame({
      contributorToken: token,
      contributorId: parsed.data.contributorId,
      contributorName: parsed.data.contributorName,
      cakeTemplate: parsed.data.cakeTemplate,
      snapshotKey: parsed.data.snapshotKey,
      layers: parsed.data.layers,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return handleRouteError("/api/gifts/[token]/frames POST", e);
  }
}
