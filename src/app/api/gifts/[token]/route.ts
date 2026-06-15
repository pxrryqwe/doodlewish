import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getByToken, setStatus } from "@/lib/serverStore";
import { tokenSchema } from "@/lib/schemas";
import { enforceIp } from "@/lib/ratelimit";
import { getIp, handleRouteError, parseBody } from "@/lib/request";
import { publicUrlFor } from "@/lib/r2";

export const runtime = "nodejs";

const READ_LIMITS = [
  { limit: 240, windowSec: 60 },
  { limit: 2400, windowSec: 3600 },
];
const PATCH_LIMITS = [
  { limit: 30, windowSec: 60 },
  { limit: 120, windowSec: 3600 },
];

const patchSchema = z.object({
  action: z.enum(["finalize", "open"]),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    await enforceIp("get_gift", getIp(req), READ_LIMITS);
    const { token } = await ctx.params;
    if (!tokenSchema.safeParse(token).success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const data = await getByToken(token);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const latestKey = data.frames.length
      ? data.frames[data.frames.length - 1].snapshotKey
      : null;
    // Dedupe contributor names by the name itself (case-insensitive trim).
    // Deduping by `contributorId` was too aggressive — multiple people on
    // the same device share an id, but they each entered a different name
    // when joining and should each show up.
    const seenName = new Set<string>();
    const contributorNames: string[] = [];
    for (const f of data.frames) {
      const name = f.contributorName?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenName.has(key)) continue;
      seenName.add(key);
      contributorNames.push(name);
    }
    return NextResponse.json({
      gift: data.gift,
      frameCount: data.frames.length,
      latestFrameUrl: latestKey ? publicUrlFor(latestKey) : null,
      contributorNames,
    });
  } catch (e) {
    return handleRouteError("/api/gifts/[token] GET", e);
  }
}

/** PATCH /api/gifts/{token}  body: { action: "finalize" | "open" } */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  try {
    await enforceIp("patch_gift", getIp(req), PATCH_LIMITS);
    const { token } = await ctx.params;
    if (!tokenSchema.safeParse(token).success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const parsed = await parseBody(req, patchSchema);
    if (!parsed.ok) return parsed.response;
    if (parsed.data.action === "finalize") {
      const ok = await setStatus(token, "dashboard", "sent");
      if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
    const ok = await setStatus(token, "recipient", "opened");
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError("/api/gifts/[token] PATCH", e);
  }
}
