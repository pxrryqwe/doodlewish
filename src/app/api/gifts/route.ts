import { NextRequest, NextResponse } from "next/server";
import { createGift } from "@/lib/serverStore";
import { createGiftSchema } from "@/lib/schemas";
import { enforceIp } from "@/lib/ratelimit";
import { getIp, handleRouteError, parseBody } from "@/lib/request";

export const runtime = "nodejs";

const LIMITS = [
  { limit: 20, windowSec: 60 },
  { limit: 120, windowSec: 3600 },
];

export async function POST(req: NextRequest) {
  try {
    await enforceIp("create_gift", getIp(req), LIMITS);
    const parsed = await parseBody(req, createGiftSchema);
    if (!parsed.ok) return parsed.response;
    const result = await createGift({
      creatorName: parsed.data.creatorName,
      recipientName: parsed.data.recipientName,
      note: parsed.data.note,
    });
    return NextResponse.json(result);
  } catch (e) {
    return handleRouteError("/api/gifts POST", e);
  }
}
