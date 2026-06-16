import { NextRequest, NextResponse } from "next/server";
import { getObject } from "@/lib/r2";
import { handleRouteError } from "@/lib/request";

export const runtime = "nodejs";

/**
 * Same-origin proxy for R2 objects. Used by `publicUrlFor()` so that
 * sticker / frame images load from our own origin — avoiding R2-side
 * CORS configuration entirely (the canvas needs CORS-clean images so
 * `stage.toBlob()` doesn't throw SecurityError on the tainted canvas).
 *
 * Only allows safe prefixes (stickers/, frames/).
 */
const ALLOWED_PREFIXES = ["stickers/", "frames/"];

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await ctx.params;
    const key = path.join("/");
    if (!ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const obj = await getObject(key);
    if (!obj) return new NextResponse("Not found", { status: 404 });
    // Wrap the Uint8Array in a fresh ArrayBuffer slice — NextResponse
    // body types tightened in recent versions and no longer accept the
    // raw SDK-returned view directly.
    const body = obj.body.slice().buffer as ArrayBuffer;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": obj.contentType ?? "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (e) {
    return handleRouteError("/api/img GET", e);
  }
}
