import { NextResponse } from "next/server";
import { neonHealth } from "@/lib/serverStore";
import { r2Health } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET() {
  const [neon, r2] = await Promise.all([neonHealth(), r2Health()]);
  const ok = neon.ok && r2.ok;
  return NextResponse.json(
    {
      ok,
      neon,
      r2,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasR2Bucket: !!process.env.R2_BUCKET,
        hasR2PublicBase: !!process.env.R2_PUBLIC_BASE_URL,
      },
    },
    { status: ok ? 200 : 500 }
  );
}
