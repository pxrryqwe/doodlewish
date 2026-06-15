// Shared constants + the canvas-rendering helper used by both the
// fullscreen mobile TextModal and the inline desktop text editor.

export const TEXT_COLORS = [
  "#232220",
  "#ffffff",
  "#ef5a5f",
  "#ffb74d",
  "#fdd835",
  "#66bb6a",
  "#42a5f5",
  "#ab47bc",
];

export interface FontPreset {
  label: string;
  weight: number;
  style: "normal" | "italic";
  /** CSS-side family string (works in textarea preview). */
  cssFamily: string;
  /** Optional CSS variable name; if set, we resolve it for canvas rendering. */
  cssVar?: string;
  fallback?: string;
}

export const FONT_PRESETS: FontPreset[] = [
  {
    label: "Classic",
    weight: 600,
    style: "normal",
    cssFamily: "var(--font-figtree), -apple-system, system-ui, sans-serif",
    cssVar: "--font-figtree",
    fallback: "sans-serif",
  },
  {
    label: "Elegant",
    weight: 400,
    style: "normal",
    cssFamily: "var(--font-chonburi), serif",
    cssVar: "--font-chonburi",
    fallback: "serif",
  },
  {
    label: "Sophisticated",
    weight: 600,
    style: "normal",
    cssFamily: "var(--font-prompt), sans-serif",
    cssVar: "--font-prompt",
    fallback: "sans-serif",
  },
  {
    label: "Handwritten",
    weight: 400,
    style: "normal",
    cssFamily: "var(--font-nanum-pen), cursive",
    cssVar: "--font-nanum-pen",
    fallback: "cursive",
  },
];

export function resolveFamily(font: FontPreset): string {
  if (typeof window === "undefined" || !font.cssVar) return font.cssFamily;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(font.cssVar)
    .trim();
  return value
    ? `${value}, ${font.fallback ?? "sans-serif"}`
    : font.fallback ?? "sans-serif";
}

/**
 * Render the text onto an off-screen canvas and return a PNG data URL.
 * Returns null if no canvas context is available or text is empty.
 */
export async function renderTextToDataUrl(
  text: string,
  font: FontPreset,
  color: string,
  previewSize: number
): Promise<string | null> {
  const value = text.trim();
  if (!value) return null;
  const lines = value.split("\n");
  const fontSize = Math.round(previewSize * 3);
  const lineHeight = Math.round(fontSize * 1.15);
  const padding = 24;

  const family = resolveFamily(font);
  const fontShorthand = `${font.style} ${font.weight} ${fontSize}px ${family}`;
  try {
    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.load(fontShorthand);
      await document.fonts.ready;
    }
  } catch {
    // fall through and render anyway
  }

  const probe = document.createElement("canvas");
  const pctx = probe.getContext("2d");
  if (!pctx) return null;
  pctx.font = fontShorthand;
  const lineWidths = lines.map((l) => pctx.measureText(l).width);
  const maxW = Math.max(...lineWidths);
  const w = Math.ceil(maxW + padding * 2);
  const h = lineHeight * lines.length + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = fontShorthand;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  lines.forEach((line, i) => {
    const cx = w / 2;
    const cy = padding + lineHeight * (i + 0.5);
    if (color === "#ffffff" || color === "#fdd835") {
      ctx.strokeStyle = "#232220";
      ctx.lineWidth = 6;
      ctx.strokeText(line, cx, cy);
    }
    ctx.fillStyle = color;
    ctx.fillText(line, cx, cy);
  });

  return canvas.toDataURL("image/png");
}
