import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  char,
} from "drizzle-orm/pg-core";

export const gifts = pgTable(
  "gifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status", { enum: ["draft", "collecting", "sent", "opened"] })
      .notNull()
      .default("collecting"),
    recipientName: varchar("recipient_name", { length: 80 }),
    creatorName: varchar("creator_name", { length: 80 }),
    note: varchar("note", { length: 280 }),
    cakeTemplate: varchar("cake_template", { length: 128 }),
    recipientToken: char("recipient_token", { length: 32 }).notNull(),
    contributorToken: char("contributor_token", { length: 32 }).notNull(),
    dashboardToken: char("dashboard_token", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    autoFinalizeAt: timestamp("auto_finalize_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '14 days'`),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '90 days'`),
  },
  (t) => ({
    recipientTokenIdx: uniqueIndex("gifts_recipient_token_idx").on(
      t.recipientToken
    ),
    contributorTokenIdx: uniqueIndex("gifts_contributor_token_idx").on(
      t.contributorToken
    ),
    dashboardTokenIdx: uniqueIndex("gifts_dashboard_token_idx").on(
      t.dashboardToken
    ),
    expiresAtIdx: index("gifts_expires_at_idx").on(t.expiresAt),
  })
);

export const frames = pgTable(
  "frames",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    giftId: uuid("gift_id")
      .notNull()
      .references(() => gifts.id, { onDelete: "cascade" }),
    contributorId: varchar("contributor_id", { length: 64 }).notNull(),
    contributorName: varchar("contributor_name", { length: 80 }),
    snapshotKey: varchar("snapshot_key", { length: 256 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    giftCreatedIdx: index("frames_gift_created_idx").on(t.giftId, t.createdAt),
    contributorIdx: index("frames_contributor_idx").on(
      t.giftId,
      t.contributorId
    ),
  })
);

export const contributions = pgTable("contributions", {
  frameId: uuid("frame_id")
    .primaryKey()
    .references(() => frames.id, { onDelete: "cascade" }),
  layers: jsonb("layers").notNull(),
});

export const customStickers = pgTable(
  "custom_stickers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contributorId: varchar("contributor_id", { length: 64 }).notNull(),
    imageKey: varchar("image_key", { length: 256 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byContributor: index("custom_stickers_contributor_idx").on(t.contributorId),
  })
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowAt: timestamp("window_at", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bucket, t.windowAt] }),
    windowIdx: index("rate_limits_window_idx").on(t.windowAt),
  })
);

export type GiftRow = typeof gifts.$inferSelect;
export type FrameRow = typeof frames.$inferSelect;
export type ContributionRow = typeof contributions.$inferSelect;
export type CustomStickerRow = typeof customStickers.$inferSelect;
