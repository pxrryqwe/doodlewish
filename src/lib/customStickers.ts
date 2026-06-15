"use client";

import { Sticker } from "@/types";
import {
  uploadSticker,
  listStickersFromServer,
  deleteStickerOnServer,
} from "./localStore";
import { getContributorId } from "./utils";

const MAX_STICKERS = 30;
const MAX_DIMENSION = 256;
const PNG_QUALITY = 0.85;

export const CUSTOM_CATEGORY = "My stickers";

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function imageToBlob(img: HTMLImageElement): Promise<Blob> {
  const ratio = Math.min(
    MAX_DIMENSION / img.width,
    MAX_DIMENSION / img.height,
    1
  );
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Could not get 2d context"));
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Encode failed"))),
      "image/png",
      PNG_QUALITY
    );
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  return imageToBlob(img);
}

/* ------------ Public API (async — hits server) ------------ */

let cache: Sticker[] | null = null;

export async function listCustomStickers(): Promise<Sticker[]> {
  const cid = getContributorId();
  if (!cid) return [];
  const rows = await listStickersFromServer(cid);
  cache = rows.map((s) => ({
    id: s.id,
    template_id: "custom",
    image_url: s.image_url,
    category: CUSTOM_CATEGORY,
    weight: 1,
  }));
  return cache;
}

export function cachedCustomStickers(): Sticker[] {
  return cache ?? [];
}

export async function removeCustomSticker(id: string): Promise<void> {
  const cid = getContributorId();
  if (!cid) return;
  await deleteStickerOnServer(cid, id);
  cache = (cache ?? []).filter((s) => s.id !== id);
}

export async function addCustomSticker(file: File): Promise<Sticker> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }
  const current = cache ?? (await listCustomStickers());
  if (current.length >= MAX_STICKERS) {
    throw new Error(`You can store up to ${MAX_STICKERS} stickers.`);
  }
  const img = await fileToImage(file);
  const blob = await imageToBlob(img);
  return saveBlob(blob);
}

/** Save a pre-prepared image (e.g. from the crop modal) as a sticker. */
export async function addCustomStickerFromDataUrl(
  dataUrl: string
): Promise<Sticker> {
  const current = cache ?? (await listCustomStickers());
  if (current.length >= MAX_STICKERS) {
    throw new Error(`You can store up to ${MAX_STICKERS} stickers.`);
  }
  const blob = await dataUrlToBlob(dataUrl);
  return saveBlob(blob);
}

async function saveBlob(blob: Blob): Promise<Sticker> {
  const cid = getContributorId();
  if (!cid) throw new Error("Couldn't identify contributor");
  const { id, imageUrl } = await uploadSticker(cid, blob);
  const sticker: Sticker = {
    id,
    template_id: "custom",
    image_url: imageUrl,
    category: CUSTOM_CATEGORY,
    weight: 1,
  };
  cache = [...(cache ?? []), sticker];
  return sticker;
}
