import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://doodlewish.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/create", "/create/select"],
        disallow: [
          "/gift",
          "/decorate",
          "/open",
          "/reveal",
          "/dashboard",
          "/admin",
          "/api",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
