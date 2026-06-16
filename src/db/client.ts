import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy-initialise the drizzle client so importing this module at build
// time (when Vercel evaluates server modules before env vars are wired
// in — particularly during the `Collecting page data` step) doesn't
// crash. The `db` proxy below only touches `DATABASE_URL` on the first
// actual query.
type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;
let _client: DrizzleClient | null = null;
function getClient(): DrizzleClient {
  if (_client) return _client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _client = drizzle(neon(url), { schema });
  return _client;
}

export const db = new Proxy({} as DrizzleClient, {
  get(_target, prop) {
    const target = getClient() as unknown as Record<string | symbol, unknown>;
    const v = target[prop];
    return typeof v === "function"
      ? (v as (...a: unknown[]) => unknown).bind(target)
      : v;
  },
});
export { schema };
