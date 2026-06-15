import type { Config } from "drizzle-kit";
import { config } from "dotenv";

// drizzle-kit CLI doesn't load .env.local like Next does — load it ourselves.
config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  breakpoints: true,
  strict: true,
  verbose: true,
} satisfies Config;
