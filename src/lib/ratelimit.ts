import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) {
    super(`Rate limited; retry in ${retryAfterSec}s`);
    this.name = "RateLimitError";
  }
}

export interface Window {
  limit: number;
  windowSec: number;
}

/**
 * Atomic fixed-window counter in Postgres. One round-trip per check.
 * Pass one or more windows to enforce burst + sustained limits simultaneously.
 */
export async function enforce(
  bucketBase: string,
  windows: Window[]
): Promise<void> {
  for (const w of windows) {
    const windowStartMs =
      Math.floor(Date.now() / 1000 / w.windowSec) * w.windowSec * 1000;
    const bucket = `${bucketBase}:${w.windowSec}`;
    const rows = (await db.execute(sql`
      insert into rate_limits (bucket, window_at, count)
      values (${bucket}, to_timestamp(${windowStartMs / 1000}), 1)
      on conflict (bucket, window_at)
      do update set count = rate_limits.count + 1
      returning count
    `)) as unknown as { rows: { count: number }[] } | { count: number }[];

    // drizzle-orm/neon-http returns the array directly; older drivers wrap in { rows }
    const result = Array.isArray(rows) ? rows : rows.rows;
    const count = Number(result[0]?.count ?? 0);

    if (count > w.limit) {
      const retry = Math.ceil(
        (windowStartMs + w.windowSec * 1000 - Date.now()) / 1000
      );
      throw new RateLimitError(Math.max(1, retry));
    }
  }
}

/** Convenience: enforce by IP. */
export async function enforceIp(
  route: string,
  ip: string,
  windows: Window[]
) {
  await enforce(`ip:${ip}:${route}`, windows);
}

/** Convenience: enforce by token / contributor id. */
export async function enforceIdentity(
  route: string,
  identity: string,
  windows: Window[]
) {
  await enforce(`id:${identity}:${route}`, windows);
}
