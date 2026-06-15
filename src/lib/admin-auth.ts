import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "dw_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET is missing or too short");
  }
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Issue a signed session token. Returns the cookie value. */
export function makeSession(): string {
  const payload = JSON.stringify({
    iat: Math.floor(Date.now() / 1000),
    nonce: Math.random().toString(36).slice(2),
  });
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${sign(b64)}`;
}

export function verifySession(cookie: string | undefined): boolean {
  if (!cookie) return false;
  const [b64, sig] = cookie.split(".");
  if (!b64 || !sig) return false;
  const expected = sign(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString());
    const ageSec = Math.floor(Date.now() / 1000) - Number(payload.iat ?? 0);
    return ageSec >= 0 && ageSec <= COOKIE_MAX_AGE;
  } catch {
    return false;
  }
}

export function cookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

export const ADMIN_COOKIE = COOKIE_NAME;

export function passwordOk(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
