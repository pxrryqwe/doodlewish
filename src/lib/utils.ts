export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Generate a v4-ish UUID without requiring a secure context.
 * `crypto.randomUUID` only exists on HTTPS/localhost — when the dev server is
 * accessed over plain HTTP from a phone on the LAN (e.g. http://192.168.x.x)
 * it is undefined and throws. Falls back to `crypto.getRandomValues` (always
 * available) and finally to Math.random for absolute safety.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fall through
    }
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // RFC 4122 v4 bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

export function getContributorId(): string {
  if (typeof window === "undefined") return "";
  const key = "dw_contributor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = uuid();
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * Copy text to the clipboard with a fallback for non-secure contexts.
 * `navigator.clipboard` only exists on HTTPS / localhost — on plain HTTP
 * (e.g. a phone hitting http://192.168.x.x in dev) it's `undefined` and
 * crashes. Falls back to a hidden textarea + `document.execCommand("copy")`,
 * which still works in every browser without requiring a secure context.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function" &&
      window.isSecureContext !== false
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function getBaseUrl(): string {
  // In the browser, always use the current origin so copied links point
  // to the same host the user is on (avoids the classic dev-vs-prod
  // mix-up where NEXT_PUBLIC_BASE_URL is hard-coded to production and
  // dev links 404 against the real prod DB).
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return "http://localhost:3000";
}
