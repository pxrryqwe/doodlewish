"use client";

type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type DwEvent =
  | "gift_created"
  | "link_copied"
  | "gift_joined"
  | "sticker_added"
  | "frame_submitted"
  | "gift_sent"
  | "gift_opened"
  | "export_started"
  | "export_saved"
  | "export_failed";

export function track(event: DwEvent, params?: GtagParams) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;
  window.gtag("event", event, params ?? {});
}

/** Hash a gift id to 8 hex chars for analytics correlation without leaking
 *  the actual id. Plain non-crypto hash — fine for telemetry. */
export function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function isDesktop(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(min-width: 1024px)").matches ? "desktop" : "mobile";
}
