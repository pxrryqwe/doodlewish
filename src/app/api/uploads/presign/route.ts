import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { presignSchema } from "@/lib/schemas";
import { enforceIp, enforceIdentity } from "@/lib/ratelimit";
import { getIp, handleRouteError, parseBody } from "@/lib/request";
import { presignPut, publicUrlFor } from "@/lib/r2";
import { db } from "@/db/client";
import { gifts as giftsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const IP_LIMITS = [
  { limit: 120, windowSec: 60 },
  { limit: 600, windowSec: 3600 },
];
const IDENTITY_LIMITS = [{ limit: 200, windowSec: 3600 }];

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseBody(req, presignSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    await enforceIp("presign", getIp(req), IP_LIMITS);
    await enforceIdentity("presign", body.contributorId, IDENTITY_LIMITS);

    let key: string;
    if (body.kind === "frame") {
      // Resolve contributor token to gift id so the client cannot upload
      // into another gift's prefix.
      const [gift] = await db
        .select({ id: giftsTable.id, status: giftsTable.status })
        .from(giftsTable)
        .where(eq(giftsTable.contributorToken, body.contributorToken))
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
    } else {
      key = `stickers/${body.contributorId}/${randomUUID()}.png`;
    }

    const uploadUrl = await presignPut(
      key,
      body.contentType,
      body.contentLength,
      60
    );
    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl: publicUrlFor(key),
    });
  } catch (e) {
    return handleRouteError("/api/uploads/presign POST", e);
  }
}
