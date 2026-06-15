import { and, asc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  gifts as giftsTable,
  frames as framesTable,
  contributions as contributionsTable,
  customStickers as customStickersTable,
} from "@/db/schema";
import type { Gift, GiftStatus, Layer } from "@/types";
import { deleteObjects, publicUrlFor } from "@/lib/r2";

function makeHexToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type GiftRow = typeof giftsTable.$inferSelect;
type FrameRow = typeof framesTable.$inferSelect;

function rowToGift(r: GiftRow): Gift {
  return {
    id: r.id,
    template_id: "cake",
    status: r.status as GiftStatus,
    recipient_name: r.recipientName,
    creator_name: r.creatorName,
    note: r.note,
    recipient_token: r.recipientToken,
    contributor_token: r.contributorToken,
    dashboard_token: r.dashboardToken,
    created_at: r.createdAt.toISOString(),
    auto_finalize_at: r.autoFinalizeAt.toISOString(),
    cake_template: r.cakeTemplate ?? null,
  };
}

/* --------------- Create --------------- */

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

export async function createGift(
  input: CreateGiftInput
): Promise<CreateGiftResult> {
  const recipientToken = makeHexToken();
  const contributorToken = makeHexToken();
  const dashboardToken = makeHexToken();
  const [row] = await db
    .insert(giftsTable)
    .values({
      status: "collecting",
      recipientName: input.recipientName,
      creatorName: input.creatorName,
      note: input.note,
      recipientToken,
      contributorToken,
      dashboardToken,
    })
    .returning({ id: giftsTable.id });
  return {
    giftId: row.id,
    contributorToken,
    dashboardToken,
    recipientToken,
  };
}

/* --------------- Token lookups --------------- */

export type TokenKind = "contributor" | "recipient" | "dashboard" | "any";

async function findGiftByToken(
  token: string,
  kind: TokenKind
): Promise<GiftRow | null> {
  let row: GiftRow | undefined;
  if (kind === "contributor" || kind === "any") {
    [row] = await db
      .select()
      .from(giftsTable)
      .where(eq(giftsTable.contributorToken, token))
      .limit(1);
    if (row || kind === "contributor") return row ?? null;
  }
  if (kind === "recipient" || kind === "any") {
    [row] = await db
      .select()
      .from(giftsTable)
      .where(eq(giftsTable.recipientToken, token))
      .limit(1);
    if (row || kind === "recipient") return row ?? null;
  }
  if (kind === "dashboard" || kind === "any") {
    [row] = await db
      .select()
      .from(giftsTable)
      .where(eq(giftsTable.dashboardToken, token))
      .limit(1);
    if (row || kind === "dashboard") return row ?? null;
  }
  return row ?? null;
}

export async function getByToken(token: string) {
  const giftRow = await findGiftByToken(token, "any");
  if (!giftRow) return null;
  const frames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.giftId, giftRow.id))
    .orderBy(asc(framesTable.createdAt));
  return {
    gift: rowToGift(giftRow),
    frames,
  };
}

/* --------------- Frames --------------- */

export interface AddFrameInput {
  contributorToken: string;
  contributorId: string;
  contributorName?: string;
  cakeTemplate?: string;
  snapshotKey: string;
  layers: Layer[];
}

export async function addFrame(
  input: AddFrameInput
): Promise<{ frameId: string; orderIndex: number } | { error: string }> {
  const giftRow = await findGiftByToken(input.contributorToken, "contributor");
  if (!giftRow) return { error: "Not found" };
  if (giftRow.status !== "collecting") {
    return { error: "Gift is no longer accepting contributions" };
  }
  // Enforce snapshot key is scoped to this gift
  const expectedPrefix = `frames/${giftRow.id}/`;
  if (!input.snapshotKey.startsWith(expectedPrefix)) {
    return { error: "Invalid snapshot key" };
  }

  try {
    const [frameRow] = await db
      .insert(framesTable)
      .values({
        giftId: giftRow.id,
        contributorId: input.contributorId,
        contributorName: input.contributorName?.trim() || null,
        snapshotKey: input.snapshotKey,
      })
      .returning({ id: framesTable.id });

    // First commit also locks in which cake template the gift uses, so
    // the export pipeline can render an empty-cake intro frame that
    // matches the template contributors actually picked.
    if (input.cakeTemplate && !giftRow.cakeTemplate) {
      const safeTemplate = input.cakeTemplate.slice(0, 128);
      await db
        .update(giftsTable)
        .set({ cakeTemplate: safeTemplate })
        .where(eq(giftsTable.id, giftRow.id));
    }

    await db.insert(contributionsTable).values({
      frameId: frameRow.id,
      layers: input.layers,
    });

    const count = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(framesTable)
      .where(eq(framesTable.giftId, giftRow.id));

    return { frameId: frameRow.id, orderIndex: count[0]?.c ?? 1 };
  } catch (e) {
    console.error("[addFrame] unexpected error:", e);
    return { error: "Server error" };
  }
}

export async function removeFrame(
  dashboardToken: string,
  frameId: string
): Promise<boolean> {
  const giftRow = await findGiftByToken(dashboardToken, "dashboard");
  if (!giftRow) return false;

  // Fetch the frame so we know which R2 object to delete.
  const [frameRow] = await db
    .select()
    .from(framesTable)
    .where(and(eq(framesTable.id, frameId), eq(framesTable.giftId, giftRow.id)))
    .limit(1);
  if (!frameRow) return false;

  await db.delete(framesTable).where(eq(framesTable.id, frameId));
  // Best-effort R2 cleanup; don't fail the user request if it errors.
  void deleteObjects([frameRow.snapshotKey]).catch(() => {});
  return true;
}

/* --------------- Status --------------- */

export async function setStatus(
  token: string,
  required: TokenKind,
  status: GiftStatus
): Promise<boolean> {
  const giftRow = await findGiftByToken(token, required);
  if (!giftRow) return false;
  const updated = await db
    .update(giftsTable)
    .set({ status })
    .where(eq(giftsTable.id, giftRow.id))
    .returning({ id: giftsTable.id });
  return updated.length > 0;
}

/* --------------- Dashboard / Reveal projections --------------- */

export async function getDashboard(token: string) {
  const giftRow = await findGiftByToken(token, "dashboard");
  if (!giftRow) return null;
  const frames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.giftId, giftRow.id))
    .orderBy(asc(framesTable.createdAt));
  return {
    gift: rowToGift(giftRow),
    frames: frames.map((f, i) => ({
      id: f.id,
      gift_id: f.giftId,
      order_index: i + 1,
      snapshot_url: publicUrlFor(f.snapshotKey),
      contributor_id: f.contributorId,
      created_at: f.createdAt.toISOString(),
    })),
  };
}

export async function getReveal(token: string) {
  const giftRow = await findGiftByToken(token, "recipient");
  if (!giftRow) return null;
  const frames = await db
    .select()
    .from(framesTable)
    .where(eq(framesTable.giftId, giftRow.id))
    .orderBy(asc(framesTable.createdAt));
  return {
    gift: rowToGift(giftRow),
    frameUrls: frames.map((f) => publicUrlFor(f.snapshotKey)),
    frameCount: frames.length,
    contributorNames: dedupeNames(frames),
  };
}

function dedupeNames(
  frames: Array<{ contributorId: string; contributorName: string | null }>
): string[] {
  // Dedupe by the name itself, not by `contributorId` — multiple people
  // sharing a device share an id but each entered a different name.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of frames) {
    const name = f.contributorName?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/* --------------- Custom stickers --------------- */

export async function addCustomSticker(
  contributorId: string,
  imageKey: string
): Promise<{ id: string }> {
  const [row] = await db
    .insert(customStickersTable)
    .values({ contributorId, imageKey })
    .returning({ id: customStickersTable.id });
  return { id: row.id };
}

export async function listCustomStickers(contributorId: string) {
  const rows = await db
    .select()
    .from(customStickersTable)
    .where(eq(customStickersTable.contributorId, contributorId))
    .orderBy(asc(customStickersTable.createdAt));
  return rows.map((r) => ({
    id: r.id,
    image_url: publicUrlFor(r.imageKey),
    image_key: r.imageKey,
    created_at: r.createdAt.toISOString(),
  }));
}

export async function removeCustomStickerDb(
  contributorId: string,
  stickerId: string
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(customStickersTable)
    .where(
      and(
        eq(customStickersTable.id, stickerId),
        eq(customStickersTable.contributorId, contributorId)
      )
    )
    .limit(1);
  if (!row) return false;
  await db.delete(customStickersTable).where(eq(customStickersTable.id, stickerId));
  void deleteObjects([row.imageKey]).catch(() => {});
  return true;
}

/* --------------- Cleanup --------------- */

export async function cleanupExpired(): Promise<{
  giftsDeleted: number;
  framesDeleted: number;
  stickersDeleted: number;
}> {
  // Gather frames + custom stickers to know what to delete in R2.
  const expiredGifts = await db
    .select({ id: giftsTable.id })
    .from(giftsTable)
    .where(lt(giftsTable.expiresAt, new Date()));
  const giftIds = expiredGifts.map((g) => g.id);

  let framesDeleted = 0;
  if (giftIds.length > 0) {
    const expiredFrames = await db
      .select({ key: framesTable.snapshotKey })
      .from(framesTable)
      .where(
        sql`${framesTable.giftId} in (${sql.join(
          giftIds.map((id) => sql`${id}::uuid`),
          sql`, `
        )})`
      );
    if (expiredFrames.length > 0) {
      await deleteObjects(expiredFrames.map((f) => f.key));
      framesDeleted = expiredFrames.length;
    }
  }

  // Orphan custom stickers older than 90 days
  const orphanStickers = await db
    .select()
    .from(customStickersTable)
    .where(lt(customStickersTable.createdAt, new Date(Date.now() - 90 * 24 * 3600 * 1000)));
  if (orphanStickers.length > 0) {
    await deleteObjects(orphanStickers.map((s) => s.imageKey));
    await db
      .delete(customStickersTable)
      .where(lt(customStickersTable.createdAt, new Date(Date.now() - 90 * 24 * 3600 * 1000)));
  }

  // Gifts cascade-delete frames + contributions
  if (giftIds.length > 0) {
    await db.delete(giftsTable).where(lt(giftsTable.expiresAt, new Date()));
  }

  // Sweep old rate_limit rows
  await db.execute(sql`delete from rate_limits where window_at < now() - interval '1 day'`);

  return {
    giftsDeleted: giftIds.length,
    framesDeleted,
    stickersDeleted: orphanStickers.length,
  };
}

export async function neonHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    await db.execute(sql`select 1`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
