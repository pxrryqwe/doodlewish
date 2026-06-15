import { NextRequest, NextResponse } from "next/server";
import { adminLoginSchema } from "@/lib/schemas";
import { ADMIN_COOKIE, cookieOptions, makeSession, passwordOk } from "@/lib/admin-auth";
import { enforceIp } from "@/lib/ratelimit";
import { getIp, handleRouteError, parseBody } from "@/lib/request";

export const runtime = "nodejs";

const LIMITS = [{ limit: 5, windowSec: 15 * 60 }];

export async function POST(req: NextRequest) {
  try {
    await enforceIp("admin_login", getIp(req), LIMITS);
    const parsed = await parseBody(req, adminLoginSchema);
    if (!parsed.ok) return parsed.response;
    if (!passwordOk(parsed.data.password)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    const opts = cookieOptions();
    res.cookies.set({
      ...opts,
      value: makeSession(),
    });
    void ADMIN_COOKIE; // ensure import retained
    return res;
  } catch (e) {
    return handleRouteError("/api/admin/login POST", e);
  }
}
