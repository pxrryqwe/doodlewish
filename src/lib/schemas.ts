import { z } from "zod";

export const tokenSchema = z.string().regex(/^[0-9a-f]{32}$/);
export const uuidSchema = z.string().regex(/^[0-9a-f-]{36}$/);
export const nameSchema = z.string().trim().min(1).max(80);
export const noteSchema = z.string().trim().max(280).nullable();
export const contributorIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const createGiftSchema = z.object({
  creatorName: nameSchema,
  recipientName: nameSchema,
  note: noteSchema,
});

export const setStatusSchema = z.object({
  status: z.enum(["draft", "collecting", "sent", "opened"]),
});

export const layerSchema = z.object({
  // Layer is archival only — we store it but never re-render from it. Keep
  // validation light: a short string. Specific refs we emit today look like
  // "dot:star", "custom:<uuid>", or a raster URL/path.
  ref: z.string().min(1).max(512),
  x: z.number(),
  y: z.number(),
  w: z.number().positive().max(4096),
  h: z.number().positive().max(4096),
  rot: z.number(),
  scale: z.number().positive().max(20),
  tint: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export const addFrameSchema = z.object({
  snapshotKey: z
    .string()
    .regex(/^frames\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/),
  contributorId: contributorIdSchema,
  contributorName: nameSchema.optional(),
  // Restricted to safe relative paths the client can pick from the
  // cake-template tray (e.g. "/cake-no-candle-3.png").
  cakeTemplate: z
    .string()
    .regex(/^\/cake-no-candle(-[2-9])?\.png$/)
    .optional(),
  layers: z.array(layerSchema).max(50),
});

export const presignFrameSchema = z.object({
  kind: z.literal("frame"),
  contentType: z.literal("image/png"),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(2 * 1024 * 1024),
  contributorToken: tokenSchema,
  contributorId: contributorIdSchema,
});

export const presignStickerSchema = z.object({
  kind: z.literal("sticker"),
  contentType: z.literal("image/png"),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(512 * 1024),
  contributorId: contributorIdSchema,
});

export const presignSchema = z.discriminatedUnion("kind", [
  presignFrameSchema,
  presignStickerSchema,
]);

export const adminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

export type Layer = z.infer<typeof layerSchema>;
