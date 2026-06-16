import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "DoodleWish — Wishes you can scribble together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  // Inline assets as base64 data URLs so `next/og` doesn't need to fetch
  // anything at render time (the old ★ glyph kept triggering a 400 on the
  // dynamic-font download path).
  async function inline(file: string): Promise<string | null> {
    try {
      const buf = await readFile(path.join(process.cwd(), "public", file));
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }
  const [cakeSrc, starSrc] = await Promise.all([
    inline("birthday-cake.png"),
    inline("star.png"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#faf8f6",
          color: "#232220",
          display: "flex",
          alignItems: "center",
          padding: 64,
        }}
      >
        {/* Left: brand wordmark */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
          }}
        >
          <div style={{ fontSize: 30, fontWeight: 500 }}>
            Wishes you can scribble together.
          </div>
          <div
            style={{
              fontSize: 150,
              fontWeight: 900,
              lineHeight: 0.95,
              marginTop: 20,
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
                width={140}
                height={140}
                style={{ marginLeft: 28 }}
              />
            )}
          </div>
        </div>

        {/* Right: birthday cake illustration */}
        {cakeSrc && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 480,
              height: 480,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cakeSrc}
              alt=""
              width={480}
              height={480}
              style={{ objectFit: "contain" }}
            />
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
