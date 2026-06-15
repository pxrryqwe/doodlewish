import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://doodlewish.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/create`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/create/select`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
