import { ImageResponse } from "next/og";

export const alt = "DoodleWish — Wishes you can scribble together";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
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
          <span style={{ fontSize: 200, marginLeft: 36 }}>★</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
