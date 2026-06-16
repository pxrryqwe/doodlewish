import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "DoodleWish — Wishes you can scribble together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // Inline the star illustration as a base64 PNG so `next/og` doesn't try
  // to download a dynamic font for the ★ glyph — that download has been
  // 400ing during build / on cold starts.
  let starSrc: string | null = null;
  try {
    const buf = await readFile(
      path.join(process.cwd(), "public", "star.png")
    );
    starSrc = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {}

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#faf8f6",
          color: "#232220",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 500 }}>
          Wishes you can scribble together.
        </div>
        <div
          style={{
            fontSize: 180,
            fontWeight: 900,
            lineHeight: 0.95,
            marginTop: 24,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span>Doodle</span>
            <span>Wish.</span>
          </div>
          {starSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={starSrc}
              alt=""
              width={200}
              height={200}
              style={{ marginLeft: 36 }}
            />
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
