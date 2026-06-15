import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { contributorIdSchema, tokenSchema } from "@/lib/schemas";
import { enforceIp, enforceIdentity } from "@/lib/ratelimit";
import { getIp, handleRouteError } from "@/lib/request";
import { putObject, publicUrlFor } from "@/lib/r2";
import { db } from "@/db/client";
import { gifts as giftsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 30;

const IP_LIMITS = [
  { limit: 120, windowSec: 60 },
  { limit: 600, windowSec: 3600 },
];
const IDENTITY_LIMITS = [{ limit: 200, windowSec: 3600 }];

const FRAME_MAX = 2 * 1024 * 1024;
const STICKER_MAX = 512 * 1024;

/**
 * Server-side blob upload to R2. Replaces the older presign + browser-PUT
 * flow, which required R2 CORS to allow every origin (and broke in mobile
 * Safari with "Load failed" / Chrome with "Failed to fetch"). The client
 * just POSTs the PNG here; the server forwards it to R2 using the R2 S3
 * credentials.
 *
 * For `kind=frame` the caller continues with POST /api/gifts/[token]/frames
 * passing the returned `key` as `snapshotKey`. For `kind=sticker` prefer
 * /api/stickers/upload, which combines upload + DB-row creation.
 */
export async function POST(req: NextRequest) {
  try {
    await enforceIp("upload_blob", getIp(req), IP_LIMITS);

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType !== "image/png") {
      return NextResponse.json(
        { error: "Content-Type must be image/png" },
        { status: 400 }
      );
    }

    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind");
    const contributorId = sp.get("contributorId") ?? "";
    const parsedCid = contributorIdSchema.safeParse(contributorId);
    if (!parsedCid.success) {
      return NextResponse.json(
        { error: "Invalid contributorId" },
        { status: 400 }
      );
    }
    await enforceIdentity("upload_blob", parsedCid.data, IDENTITY_LIMITS);

    let key: string;
    if (kind === "frame") {
      const contributorToken = sp.get("contributorToken") ?? "";
      if (!tokenSchema.safeParse(contributorToken).success) {
        return NextResponse.json(
          { error: "Invalid contributorToken" },
          { status: 400 }
        );
      }
      const [gift] = await db
        .select({ id: giftsTable.id, status: giftsTable.status })
        .from(giftsTable)
        .where(eq(giftsTable.contributorToken, contributorToken))
        .limit(1);
      if (!gift) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (gift.status !== "collecting") {
        return NextResponse.json(
          { error: "Gift is no longer accepting contributions" },
          { status: 400 }
        );
      }
      key = `frames/${gift.id}/${randomUUID()}.png`;
    } else if (kind === "sticker") {
      key = `stickers/${parsedCid.data}/${randomUUID()}.png`;
    } else {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    const buf = Buffer.from(await req.arrayBuffer());
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: "Empty body" }, { status: 400 });
    }
    const cap = kind === "frame" ? FRAME_MAX : STICKER_MAX;
    if (buf.byteLength > cap) {
      return NextResponse.json(
        { error: `Image too large (max ${cap} bytes)` },
        { status: 413 }
      );
    }

    await putObject(key, "image/png", buf);
    return NextResponse.json({ key, publicUrl: publicUrlFor(key) });
  } catch (e) {
    return handleRouteError("/api/uploads/blob POST", e);
  }
}
