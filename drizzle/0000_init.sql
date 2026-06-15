CREATE TABLE "contributions" (
	"frame_id" uuid PRIMARY KEY NOT NULL,
	"layers" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_stickers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contributor_id" varchar(64) NOT NULL,
	"image_key" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frames" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_id" uuid NOT NULL,
	"contributor_id" varchar(64) NOT NULL,
	"snapshot_key" varchar(256) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'collecting' NOT NULL,
	"recipient_name" varchar(80),
	"creator_name" varchar(80),
	"note" varchar(280),
	"recipient_token" char(32) NOT NULL,
	"contributor_token" char(32) NOT NULL,
	"dashboard_token" char(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"auto_finalize_at" timestamp with time zone DEFAULT now() + interval '14 days' NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '90 days' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text NOT NULL,
	"window_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_bucket_window_at_pk" PRIMARY KEY("bucket","window_at")
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_frame_id_frames_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."frames"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_gift_id_gifts_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_stickers_contributor_idx" ON "custom_stickers" USING btree ("contributor_id");--> statement-breakpoint
CREATE INDEX "frames_gift_created_idx" ON "frames" USING btree ("gift_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "frames_one_per_contributor" ON "frames" USING btree ("gift_id","contributor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gifts_recipient_token_idx" ON "gifts" USING btree ("recipient_token");--> statement-breakpoint
CREATE UNIQUE INDEX "gifts_contributor_token_idx" ON "gifts" USING btree ("contributor_token");--> statement-breakpoint
CREATE UNIQUE INDEX "gifts_dashboard_token_idx" ON "gifts" USING btree ("dashboard_token");--> statement-breakpoint
CREATE INDEX "gifts_expires_at_idx" ON "gifts" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_at");