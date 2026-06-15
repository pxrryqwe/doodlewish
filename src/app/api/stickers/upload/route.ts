import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { contributorIdSchema } from "@/lib/schemas";
import { enforceIp, enforceIdentity } from "@/lib/ratelimit";
import { getIp, handleRouteError } from "@/lib/request";
import { putObject, publicUrlFor } from "@/lib/r2";
import { addCustomSticker } from "@/lib/serverStore";

export const runtime = "nodejs";

const IP_LIMITS = [
  { limit: 120, windowSec: 60 },
  { limit: 600, windowSec: 3600 },
];
const IDENTITY_LIMITS = [{ limit: 200, windowSec: 3600 }];

const MAX_SIZE = 512 * 1024; // 512KB — matches presignStickerSchema cap

/**
 * Server-side sticker upload. Avoids direct browser → R2 PUT (which
 * requires R2 CORS to allow each origin). Client POSTs the PNG body
 * here; we forward it to R2 using the R2 S3 credentials, then create
 * the DB row in one step.
 */
export async function POST(req: NextRequest) {
  try {
    await enforceIp("upload_sticker", getIp(req), IP_LIMITS);

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType !== "image/png") {
      return NextResponse.json(
        { error: "Content-Type must be image/png" },
        { status: 400 }
      );
    }

    const cid = req.nextUrl.searchParams.get("contributorId") ?? "";
    const parsedCid = contributorIdSchema.safeParse(cid);
    if (!parsedCid.success) {
      return NextResponse.json(
        { error: "Invalid contributorId" },
        { status: 400 }
      );
    }
    await enforceIdentity("upload_sticker", parsedCid.data, IDENTITY_LIMITS);

    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }
    if (buf.byteLength > MAX_SIZE) {
      return NextResponse.json(
        { error: `Sticker too large (max ${MAX_SIZE} bytes)` },
        { status: 413 }
      );
    }

    const key = `stickers/${parsedCid.data}/${randomUUID()}.png`;
    await putObject(key, "image/png", buf);
    const { id } = await addCustomSticker(parsedCid.data, key);
    return NextResponse.json({
      id,
      imageUrl: publicUrlFor(key),
    });
  } catch (e) {
    return handleRouteError("/api/stickers/upload POST", e);
  }
}
