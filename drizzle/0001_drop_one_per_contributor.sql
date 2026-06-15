DROP INDEX "frames_one_per_contributor";--> statement-breakpoint
CREATE INDEX "frames_contributor_idx" ON "frames" USING btree ("gift_id","contributor_id");