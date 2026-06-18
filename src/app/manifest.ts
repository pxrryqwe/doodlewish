import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DoodleWish — Wishes you can scribble together",
    short_name: "DoodleWish",
    description:
      "A collaborative birthday-card maker. Friends doodle a frame each on a shared cake; the recipient opens it as a stop-motion surprise.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf8f6",
    theme_color: "#faf8f6",
    icons: [
      {
        src: "/icon.png",
        sizes: "2048x2048",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "2048x2048",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
