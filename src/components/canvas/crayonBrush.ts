/**
 * Crayon-style stroke renderer. Strategy:
 *   1) Lay down a crisp solid line (so the stroke reads sharply).
 *   2) Punch small semi-transparent "holes" along the line using
 *      `destination-out` — this gives the waxy speckled coverage of
 *      real crayon without blurring the stroke edges.
 *   3) Drop a few solid color flecks just outside the stroke edge
 *      for a bristly/scratchy feel.
 *
 * Caller must set `ctx.fillStyle` (= the stroke color) before calling
 * and must be in `source-over` composite mode.
 */
export function drawCrayonSegment(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number
) {
  const color = ctx.fillStyle as string;
  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  // 1) Crisp solid stroke body
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  const dist = Math.hypot(x2 - x1, y2 - y1);

  // 2) Speckle holes punched into the stroke (waxy crayon texture)
  ctx.globalCompositeOperation = "destination-out";
  const holeCount = Math.max(2, Math.floor(dist / 2.5));
  for (let i = 0; i < holeCount; i++) {
    const t = Math.random();
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    // Keep holes inside the stroke radius so the edge stays crisp.
    const offRange = (size / 2) * 0.7;
    const ox = (Math.random() - 0.5) * 2 * offRange;
    const oy = (Math.random() - 0.5) * 2 * offRange;
    const r = Math.max(0.7, size * 0.07 * (0.8 + Math.random() * 1.4));
    ctx.globalAlpha = 0.35 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(px + ox, py + oy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3) Bristle flecks just outside the stroke for a scratchy edge
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  const fleckCount = Math.max(1, Math.floor(dist / 6));
  for (let i = 0; i < fleckCount; i++) {
    const t = Math.random();
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    const angle = Math.random() * Math.PI * 2;
    // Sit just outside the stroke edge.
    const off = (size / 2) * (1.0 + Math.random() * 0.35);
    const r = Math.max(0.6, size * 0.07 * (0.6 + Math.random() * 0.8));
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.arc(px + Math.cos(angle) * off, py + Math.sin(angle) * off, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;
}

/** Single tap = one crisp filled dot + a tiny bit of grain. */
export function drawCrayonDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
) {
  const color = ctx.fillStyle as string;
  const prevAlpha = ctx.globalAlpha;
  const prevComposite = ctx.globalCompositeOperation;

  // Solid core
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Punch a few speckle holes
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const off = (size / 2) * 0.7 * Math.random();
    const r = Math.max(0.7, size * 0.08 * (0.8 + Math.random() * 1.2));
    ctx.globalAlpha = 0.4 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * off, y + Math.sin(angle) * off, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A couple of edge bristles
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const off = (size / 2) * (1.0 + Math.random() * 0.3);
    const r = Math.max(0.6, size * 0.08 * (0.6 + Math.random() * 0.8));
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * off, y + Math.sin(angle) * off, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevComposite;
}
