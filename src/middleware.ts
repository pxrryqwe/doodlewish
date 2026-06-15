import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL ?? "";

function csp(): string {
  const r2Host = PUBLIC_BASE
    ? new URL(PUBLIC_BASE).host
    : "*.r2.dev";
  return [
    "default-src 'self'",
    `img-src 'self' data: blob: https://${r2Host} https://*.r2.dev https://*.googleusercontent.com`,
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    `connect-src 'self' https://${r2Host} https://*.r2.dev https://*.r2.cloudflarestorage.com https://www.google-analytics.com https://region1.google-analytics.com https://analyticsdata.googleapis.com`,
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Content-Security-Policy": csp(),
};

export function middleware(req: NextRequest) {
  // Admin guard: anything under /admin (except /admin/login) needs a session cookie.
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const cookie = req.cookies.get("dw_admin")?.value;
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export const config = {
  matcher: [
    // All routes except Next internals + R2 image proxy + favicons
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
