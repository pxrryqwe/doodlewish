import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { RateLimitError } from "@/lib/ratelimit";

export function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid input", issues: result.error.issues },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}

export function handleRouteError(label: string, e: unknown): NextResponse {
  if (e instanceof RateLimitError) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } }
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid input", issues: e.issues },
      { status: 400 }
    );
  }
  console.error(`[${label}]`, e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
