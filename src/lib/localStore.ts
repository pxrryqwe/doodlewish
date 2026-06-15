"use client";

import { Gift, Frame, Sticker, StickerLayer, Layer } from "@/types";

/* ------------ Default stickers (Dot Art collection) ------------ */

// Files live in /public/sticker/dot/<name>.svg. Add new files to the array
// below to expose them in the Dot Art category.
const DOT_ART_STICKERS: string[] = [
  "bow",
  "clover",
  "heart",
  "rose",
  "star",
];

const DOT_ART_CATEGORY = "Dot Art";

let stickerCache: Sticker[] | null = null;
export function defaultStickers(): Sticker[] {
  if (stickerCache) return stickerCache;
  stickerCache = DOT_ART_STICKERS.map((name) => ({
    id: `dot-${name}`,
    template_id: "default",
    image_url: `/sticker/dot/${name}.svg`,
    category: DOT_ART_CATEGORY,
    weight: 1,
  }));
  return stickerCache;
}

/* ------------ Layer translation: StickerLayer (UI) → Layer (server) ------------ */

function stickerLayerToLayer(s: StickerLayer): Layer {
  // The canvas uses `imageUrl` as `stickerId`. Derive a stable archival ref.
  let ref = s.stickerId;
  const dotMatch = ref.match(/\/sticker\/dot\/([a-z0-9_-]+)\.svg$/i);
  const customMatch = ref.match(/\/stickers\/[^/]+\/([0-9a-f-]{36})\.png$/i);
  const uuidMatch = ref.match(/^[0-9a-f-]{36}$/i);
  if (dotMatch) {
    ref = `dot:${dotMatch[1]}`;
  } else if (customMatch) {
    ref = `custom:${customMatch[1]}`;
  } else if (uuidMatch) {
    ref = `custom:${ref}`;
  } else if (ref.startsWith("dot-")) {
    ref = `dot:${ref.slice(4)}`;
  } else {
    ref = `raster:${ref.slice(0, 480)}`;
  }
  return {
    ref,
    x: s.x,
    y: s.y,
    w: s.width,
    h: s.height,
    rot: s.rotation,
    scale: s.scaleX,
  };
}

/* ------------ Remote (Neon via /api/gifts) ------------ */

export interface CreateGiftInput {
  creatorName: string;
  recipientName: string;
  note: string | null;
}
export interface CreateGiftResult {
  giftId: string;
  contributorToken: string;
  dashboardToken: string;
  recipientToken: string;
}

async function jsonFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j?.error ? ` — ${j.error}` : "";
      } catch {}
      console.warn(`[doodlewish] ${url} → HTTP ${res.status}${detail}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[doodlewish] ${url} → network error`, e);
    return null;
  }
}

export async function createGift(
  input: CreateGiftInput
): Promise<CreateGiftResult> {
  let res: Response;
  try {
    res = await fetch("/api/gifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error(
      "Couldn't reach the server. Check your internet, then try again."
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error ? ` (${j.error})` : "";
    } catch {}
    throw new Error(`Server error${detail}`);
  }
  return res.json();
}

export interface GiftSnapshot {
  gift: Gift;
  frameCount: number;
  stickers: Sticker[];
  latestFrameUrl: string | null;
  contributorNames: string[];
}

export async function getGiftByAnyToken(
  token: string
): Promise<GiftSnapshot | null> {
  const data = await jsonFetch<{
    gift: Gift;
    frameCount: number;
    latestFrameUrl: string | null;
    contributorNames?: string[];
  }>(`/api/gifts/${encodeURIComponent(token)}`);
  if (!data) return null;
  return {
    gift: data.gift,
    frameCount: data.frameCount,
    stickers: defaultStickers(),
    latestFrameUrl: data.latestFrameUrl,
    contributorNames: data.contributorNames ?? [],
  };
}

export interface DashboardSnapshot {
  gift: Gift;
  frames: Frame[];
}
export async function getDashboard(
  dashboardToken: string
): Promise<DashboardSnapshot | null> {
  return jsonFetch<DashboardSnapshot>(
    `/api/gifts/${encodeURIComponent(dashboardToken)}/dashboard`
  );
}

/* ------------ R2 upload helpers ------------ */

interface PresignResp {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

async function presign(body: object): Promise<PresignResp> {
  let res: Response;
  try {
    res = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("Presign network error", { body, err: e });
    throw new Error(
      "Couldn't reach the server. Check your connection and try again."
    );
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.error("Presign non-OK", { status: res.status, body, json: j });
    throw new Error(j.error || `Presign failed (${res.status})`);
  }
  return res.json();
}

async function uploadPngToR2(blob: Blob, uploadUrl: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: blob,
    });
  } catch (e) {
    // iOS Safari surfaces network / CORS preflight failures as
    // `TypeError: Load failed`, which alerted as a confusing "Load failed".
    // Re-wrap with a clearer message and log details for debugging.
    console.error("R2 PUT network error", {
      uploadUrl,
      size: blob.size,
      err: e,
    });
    throw new Error(
      "Couldn't reach image storage. Check your connection and try again."
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {}
    console.error("R2 PUT non-OK", { status: res.status, detail });
    throw new Error(`R2 upload failed (${res.status})`);
  }
}

/* ------------ Frame submission ------------ */

export interface AddFrameInput {
  contributorToken: string;
  contributorId: string;
  contributorName?: string;
  cakeTemplate?: string;
  pngBlob: Blob;
  layers: StickerLayer[];
}

export async function addFrame(
  input: AddFrameInput
): Promise<{ frameId: string; orderIndex: number } | { error: string }> {
  try {
    // Upload the PNG through our own server (avoids R2 CORS issues that
    // surface as "Load failed" on iOS Safari / "Failed to fetch" on Chrome).
    let uploadRes: Response;
    try {
      uploadRes = await fetch(
        `/api/uploads/blob?kind=frame&contributorToken=${encodeURIComponent(
          input.contributorToken
        )}&contributorId=${encodeURIComponent(input.contributorId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: input.pngBlob,
        }
      );
    } catch (e) {
      console.error("Frame blob upload network error", {
        size: input.pngBlob.size,
        err: e,
      });
      throw new Error(
        "Couldn't reach the server. Check your connection and try again."
      );
    }
    if (!uploadRes.ok) {
      const j = await uploadRes.json().catch(() => ({}));
      console.error("Frame blob upload non-OK", {
        status: uploadRes.status,
        json: j,
      });
      throw new Error(j.error || `Upload failed (${uploadRes.status})`);
    }
    const { key: snapshotKey } = (await uploadRes.json()) as { key: string };

    const slimLayers: Layer[] = input.layers.map(stickerLayerToLayer);
    const res = await fetch(
      `/api/gifts/${encodeURIComponent(input.contributorToken)}/frames`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotKey,
          contributorId: input.contributorId,
          contributorName: input.contributorName,
          cakeTemplate: input.cakeTemplate,
          layers: slimLayers,
        }),
      }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { error: j.error || "Server error" };
    }
    return res.json();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed" };
  }
}

export async function removeFrame(
  dashboardToken: string,
  frameId: string
): Promise<boolean> {
  const res = await fetch(
    `/api/gifts/${encodeURIComponent(dashboardToken)}/frames/${encodeURIComponent(frameId)}`,
    { method: "DELETE" }
  );
  return res.ok;
}

export async function finalizeGift(dashboardToken: string): Promise<boolean> {
  const res = await fetch(`/api/gifts/${encodeURIComponent(dashboardToken)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "finalize" }),
  });
  return res.ok;
}

export async function markOpened(recipientToken: string): Promise<boolean> {
  const res = await fetch(`/api/gifts/${encodeURIComponent(recipientToken)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "open" }),
  });
  return res.ok;
}

export interface RevealSnapshot {
  gift: Gift;
  frameUrls: string[];
  frameCount: number;
}
export async function getReveal(
  recipientToken: string
): Promise<RevealSnapshot | null> {
  return jsonFetch<RevealSnapshot>(
    `/api/gifts/${encodeURIComponent(recipientToken)}/reveal`
  );
}

/* ------------ Custom sticker helpers (used by customStickers.ts) ------------ */

export async function presignSticker(
  contributorId: string,
  pngBlob: Blob
): Promise<PresignResp> {
  return presign({
    kind: "sticker",
    contentType: "image/png",
    contentLength: pngBlob.size,
    contributorId,
  });
}

export async function uploadSticker(
  contributorId: string,
  pngBlob: Blob
): Promise<{ id: string; imageUrl: string }> {
  // Upload through our own server (avoids browser → R2 CORS preflight,
  // which fails on iOS Safari with "Load failed" and on Chrome with
  // "Failed to fetch" unless R2 CORS is configured for every origin).
  let res: Response;
  try {
    res = await fetch(
      `/api/stickers/upload?contributorId=${encodeURIComponent(contributorId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: pngBlob,
      }
    );
  } catch (e) {
    console.error("Sticker upload network error", { size: pngBlob.size, err: e });
    throw new Error(
      "Couldn't reach the server. Check your connection and try again."
    );
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.error("Sticker upload non-OK", { status: res.status, json: j });
    throw new Error(j.error || `Sticker upload failed (${res.status})`);
  }
  const { id, imageUrl } = await res.json();
  return { id, imageUrl };
}

export async function listStickersFromServer(
  contributorId: string
): Promise<{ id: string; image_url: string }[]> {
  const res = await fetch(
    `/api/stickers?contributorId=${encodeURIComponent(contributorId)}`
  );
  if (!res.ok) return [];
  const j = await res.json();
  return j.stickers ?? [];
}

export async function deleteStickerOnServer(
  contributorId: string,
  stickerId: string
): Promise<boolean> {
  const res = await fetch("/api/stickers", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contributorId, stickerId }),
  });
  return res.ok;
}
