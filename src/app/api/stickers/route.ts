import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  addCustomSticker,
  listCustomStickers,
  removeCustomStickerDb,
} from "@/lib/serverStore";
import { contributorIdSchema } from "@/lib/schemas";
import { enforceIp } from "@/lib/ratelimit";
import { getIp, handleRouteError, parseBody } from "@/lib/request";

export const runtime = "nodejs";

const READ_LIMITS = [
  { limit: 240, windowSec: 60 },
  { limit: 2400, windowSec: 3600 },
];
const WRITE_LIMITS = [
  { limit: 120, windowSec: 60 },
  { limit: 600, windowSec: 3600 },
];

const addSchema = z.object({
  contributorId: contributorIdSchema,
  imageKey: z.string().regex(/^stickers\/[A-Za-z0-9_-]{8,64}\/[0-9a-f-]{36}\.png$/),
});

export async function GET(req: NextRequest) {
  try {
    await enforceIp("list_stickers", getIp(req), READ_LIMITS);
    const cid = req.nextUrl.searchParams.get("contributorId") ?? "";
    if (!contributorIdSchema.safeParse(cid).success) {
      return NextResponse.json({ error: "Invalid contributorId" }, { status: 400 });
    }
    const stickers = await listCustomStickers(cid);
    return NextResponse.json({ stickers });
  } catch (e) {
    return handleRouteError("/api/stickers GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await enforceIp("add_sticker", getIp(req), WRITE_LIMITS);
    const parsed = await parseBody(req, addSchema);
    if (!parsed.ok) return parsed.response;
    // Sanity: key prefix must match the contributor id supplied
    const expected = `stickers/${parsed.data.contributorId}/`;
    if (!parsed.data.imageKey.startsWith(expected)) {
      return NextResponse.json({ error: "Key mismatch" }, { status: 400 });
    }
    const result = await addCustomSticker(
      parsed.data.contributorId,
      parsed.data.imageKey
    );
    return NextResponse.json(result);
  } catch (e) {
    return handleRouteError("/api/stickers POST", e);
  }
}

const deleteSchema = z.object({
  contributorId: contributorIdSchema,
  stickerId: z.string().regex(/^[0-9a-f-]{36}$/),
});

export async function DELETE(req: NextRequest) {
  try {
    await enforceIp("delete_sticker", getIp(req), WRITE_LIMITS);
    const parsed = await parseBody(req, deleteSchema);
    if (!parsed.ok) return parsed.response;
    const ok = await removeCustomStickerDb(
      parsed.data.contributorId,
      parsed.data.stickerId
    );
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleRouteError("/api/stickers DELETE", e);
  }
}
