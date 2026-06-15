export type GiftStatus = "draft" | "collecting" | "sent" | "opened";

export interface Gift {
  id: string;
  template_id: string;
  status: GiftStatus;
  recipient_name: string | null;
  creator_name: string | null;
  note: string | null;
  recipient_token: string;
  contributor_token: string;
  dashboard_token: string;
  created_at: string;
  auto_finalize_at: string;
  cake_template: string | null;
}

export interface Frame {
  id: string;
  gift_id: string;
  order_index: number;
  snapshot_url: string | null;
  contributor_id: string;
  created_at: string;
}

/** Slim layer record stored in `contributions.layers` jsonb. */
export interface Layer {
  ref: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  scale: number;
  tint?: string;
}

/** Legacy shape still emitted by DecorationCanvas. Translated to `Layer`
 *  before reaching the server (see `localStore.addFrame`). */
export interface StickerLayer {
  stickerId: string;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Sticker {
  id: string;
  template_id: string;
  image_url: string;
  category: string;
  weight: number;
}
