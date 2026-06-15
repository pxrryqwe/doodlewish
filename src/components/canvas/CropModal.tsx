"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { cn } from "@/lib/utils";

interface Props {
  file: File;
  onDone: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

type Mode = "rect" | "free";

const HANDLE_SIZE = 36;
const MIN_CROP = 40; // image pixels
const MIN_POLY_POINTS = 6;

type DragMode = "move" | "tl" | "tr" | "bl" | "br";

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function CropModal({ file, onDone, onCancel }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>("rect");

  // Rectangle crop
  const [crop, setCrop] = useState<CropRect | null>(null);
  const rectDragRef = useRef<{
    mode: DragMode;
    startClientX: number;
    startClientY: number;
    startCrop: CropRect;
  } | null>(null);

  // Free cutout (points in IMAGE space)
  const [polyPoints, setPolyPoints] = useState<Point[]>([]);
  const drawingRef = useRef(false);

  // Load file
  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (cancelled) return;
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setImageUrl(url);
        setImgSize({ w: img.width, h: img.height });
        const s = Math.min(img.width, img.height) * 0.8;
        setCrop({
          x: (img.width - s) / 2,
          y: (img.height - s) / 2,
          w: s,
          h: s,
        });
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Measure container
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      setContainerSize({
        w: containerRef.current.clientWidth,
        h: containerRef.current.clientHeight,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [imageUrl]);

  // Reset poly when switching modes
  useEffect(() => {
    if (mode === "rect") setPolyPoints([]);
  }, [mode]);

  // Display layout
  const fit =
    imgSize.w > 0 && containerSize.w > 0
      ? Math.min(containerSize.w / imgSize.w, containerSize.h / imgSize.h)
      : 0;
  const displayW = imgSize.w * fit;
  const displayH = imgSize.h * fit;
  const offsetX = (containerSize.w - displayW) / 2;
  const offsetY = (containerSize.h - displayH) / 2;

  /* ---------------- Rectangle drag handling ---------------- */
  const handleRectMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!rectDragRef.current || !crop || fit === 0) return;
      const { mode: m, startClientX, startClientY, startCrop } =
        rectDragRef.current;
      const dx = (clientX - startClientX) / fit;
      const dy = (clientY - startClientY) / fit;
      const next: CropRect = { ...startCrop };
      if (m === "move") {
        next.x = clamp(startCrop.x + dx, 0, imgSize.w - startCrop.w);
        next.y = clamp(startCrop.y + dy, 0, imgSize.h - startCrop.h);
      } else if (m === "tl") {
        const nx = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.w - MIN_CROP);
        const ny = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.h - MIN_CROP);
        next.x = nx;
        next.y = ny;
        next.w = startCrop.w - (nx - startCrop.x);
        next.h = startCrop.h - (ny - startCrop.y);
      } else if (m === "tr") {
        const ny = clamp(startCrop.y + dy, 0, startCrop.y + startCrop.h - MIN_CROP);
        const nw = clamp(startCrop.w + dx, MIN_CROP, imgSize.w - startCrop.x);
        next.y = ny;
        next.w = nw;
        next.h = startCrop.h - (ny - startCrop.y);
      } else if (m === "bl") {
        const nx = clamp(startCrop.x + dx, 0, startCrop.x + startCrop.w - MIN_CROP);
        const nh = clamp(startCrop.h + dy, MIN_CROP, imgSize.h - startCrop.y);
        next.x = nx;
        next.w = startCrop.w - (nx - startCrop.x);
        next.h = nh;
      } else if (m === "br") {
        next.w = clamp(startCrop.w + dx, MIN_CROP, imgSize.w - startCrop.x);
        next.h = clamp(startCrop.h + dy, MIN_CROP, imgSize.h - startCrop.y);
      }
      setCrop(next);
    },
    [crop, fit, imgSize.h, imgSize.w]
  );

  /* ---------------- Free-cut path handling ---------------- */
  const toImageSpace = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current || fit === 0) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = clientX - rect.left - offsetX;
      const cy = clientY - rect.top - offsetY;
      const x = clamp(cx / fit, 0, imgSize.w);
      const y = clamp(cy / fit, 0, imgSize.h);
      return { x, y };
    },
    [fit, imgSize.h, imgSize.w, offsetX, offsetY]
  );

  const startFree = useCallback(
    (clientX: number, clientY: number) => {
      const p = toImageSpace(clientX, clientY);
      if (!p) return;
      drawingRef.current = true;
      setPolyPoints([p]);
    },
    [toImageSpace]
  );

  const moveFree = useCallback(
    (clientX: number, clientY: number) => {
      if (!drawingRef.current) return;
      const p = toImageSpace(clientX, clientY);
      if (!p) return;
      setPolyPoints((prev) => {
        const last = prev[prev.length - 1];
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 2) return prev;
        return [...prev, p];
      });
    },
    [toImageSpace]
  );

  const endFree = useCallback(() => {
    drawingRef.current = false;
  }, []);

  /* ---------------- Global drag listeners ---------------- */
  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      if (rectDragRef.current) {
        e.preventDefault();
        handleRectMove(t.clientX, t.clientY);
      } else if (drawingRef.current) {
        e.preventDefault();
        moveFree(t.clientX, t.clientY);
      }
    }
    function onMouseMove(e: MouseEvent) {
      if (rectDragRef.current) handleRectMove(e.clientX, e.clientY);
      else if (drawingRef.current) moveFree(e.clientX, e.clientY);
    }
    function onEnd() {
      rectDragRef.current = null;
      if (drawingRef.current) endFree();
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [handleRectMove, moveFree, endFree]);

  function beginRectDrag(m: DragMode, clientX: number, clientY: number) {
    if (!crop) return;
    rectDragRef.current = {
      mode: m,
      startClientX: clientX,
      startClientY: clientY,
      startCrop: { ...crop },
    };
  }

  /* ---------------- Export ---------------- */
  function exportRect() {
    if (!crop || !imageUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(crop.w);
      canvas.height = Math.round(crop.h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(
        img,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        0,
        0,
        canvas.width,
        canvas.height
      );
      onDone(canvas.toDataURL("image/png"));
    };
    img.src = imageUrl;
  }

  function exportFree() {
    if (polyPoints.length < MIN_POLY_POINTS || !imageUrl) return;
    const img = new Image();
    img.onload = () => {
      // Compute bounding box of the polygon
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of polyPoints) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const w = Math.max(1, Math.round(maxX - minX));
      const h = Math.max(1, Math.round(maxY - minY));

      // Build an off-screen canvas the size of the bbox
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Mask: draw polygon shifted so bbox starts at 0,0
      ctx.save();
      ctx.beginPath();
      polyPoints.forEach((p, i) => {
        const x = p.x - minX;
        const y = p.y - minY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.clip();

      // Draw the corresponding image region
      ctx.drawImage(img, -minX, -minY);
      ctx.restore();

      onDone(canvas.toDataURL("image/png"));
    };
    img.src = imageUrl;
  }

  function handleDone() {
    if (mode === "rect") exportRect();
    else exportFree();
  }

  /* ---------------- Render ---------------- */

  // Display-space conversions
  const scx = offsetX + (crop?.x ?? 0) * fit;
  const scy = offsetY + (crop?.y ?? 0) * fit;
  const scw = (crop?.w ?? 0) * fit;
  const sch = (crop?.h ?? 0) * fit;

  const polyDisplay = polyPoints.map(
    (p) => `${offsetX + p.x * fit},${offsetY + p.y * fit}`
  );

  const canExport =
    mode === "rect" ? !!crop : polyPoints.length >= MIN_POLY_POINTS;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      {/* Top bar */}
      <div
        className="text-white text-center font-semibold text-[16px] shrink-0 px-5 pt-3 pb-2"
        style={{ paddingTop: "max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        Cut out your sticker
      </div>

      {/* Mode tabs */}
      <div className="shrink-0 flex justify-center gap-2 px-5 pb-3">
        <ModeTab
          active={mode === "rect"}
          onClick={() => setMode("rect")}
          label="Rectangle"
        />
        <ModeTab
          active={mode === "free"}
          onClick={() => setMode("free")}
          label="Free cut ✂"
        />
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden touch-none"
        onTouchStart={(e) => {
          if (mode !== "free") return;
          const t = e.touches[0];
          startFree(t.clientX, t.clientY);
        }}
        onMouseDown={(e) => {
          if (mode !== "free") return;
          startFree(e.clientX, e.clientY);
        }}
      >
        {imageUrl && imgSize.w > 0 && (
          <>
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: offsetX,
                top: offsetY,
                width: displayW,
                height: displayH,
                userSelect: "none",
              }}
            />

            {mode === "rect" && crop && (
              <RectOverlay
                scx={scx}
                scy={scy}
                scw={scw}
                sch={sch}
                onBeginDrag={beginRectDrag}
              />
            )}

            {mode === "free" && (
              <FreeOverlay
                points={polyDisplay}
                onClear={() => setPolyPoints([])}
                pointsCount={polyPoints.length}
              />
            )}
          </>
        )}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">
            Loading…
          </div>
        )}
      </div>

      {/* Hint */}
      {mode === "free" && (
        <div className="shrink-0 text-center text-[12px] text-white/70 px-5 pb-2">
          {polyPoints.length === 0
            ? "Drag a circle around the part you want to keep."
            : polyPoints.length < MIN_POLY_POINTS
            ? "Keep drawing around the object…"
            : "Looks good. Tap Use this — or redraw."}
        </div>
      )}

      {/* Bottom actions */}
      <div
        className="shrink-0 px-5 pt-3 flex gap-3 bg-black"
        style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
      >
        <OutlineButton
          onClick={onCancel}
          className="flex-1 !text-white !border-white/40"
        >
          Cancel
        </OutlineButton>
        <PrimaryButton
          onClick={handleDone}
          disabled={!canExport}
          className="flex-1 !bg-white !text-black"
        >
          Use this
        </PrimaryButton>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 px-4 rounded-pill text-[13px] font-semibold cursor-pointer",
        active ? "bg-white text-black" : "bg-white/15 text-white"
      )}
    >
      {label}
    </button>
  );
}

function RectOverlay({
  scx,
  scy,
  scw,
  sch,
  onBeginDrag,
}: {
  scx: number;
  scy: number;
  scw: number;
  sch: number;
  onBeginDrag: (mode: DragMode, x: number, y: number) => void;
}) {
  return (
    <>
      <div
        className="absolute bg-black/55"
        style={{ left: 0, top: 0, width: "100%", height: scy }}
      />
      <div
        className="absolute bg-black/55"
        style={{ left: 0, top: scy + sch, width: "100%", bottom: 0 }}
      />
      <div
        className="absolute bg-black/55"
        style={{ left: 0, top: scy, width: scx, height: sch }}
      />
      <div
        className="absolute bg-black/55"
        style={{ left: scx + scw, top: scy, right: 0, height: sch }}
      />
      <div
        className="absolute border-2 border-white"
        style={{ left: scx, top: scy, width: scw, height: sch }}
      />
      <div
        className="absolute cursor-move"
        style={{ left: scx, top: scy, width: scw, height: sch }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          onBeginDrag("move", t.clientX, t.clientY);
        }}
        onMouseDown={(e) => onBeginDrag("move", e.clientX, e.clientY)}
      />
      <CornerHandle
        mode="tl"
        onBegin={onBeginDrag}
        style={{ left: scx - HANDLE_SIZE / 2, top: scy - HANDLE_SIZE / 2 }}
      />
      <CornerHandle
        mode="tr"
        onBegin={onBeginDrag}
        style={{ left: scx + scw - HANDLE_SIZE / 2, top: scy - HANDLE_SIZE / 2 }}
      />
      <CornerHandle
        mode="bl"
        onBegin={onBeginDrag}
        style={{ left: scx - HANDLE_SIZE / 2, top: scy + sch - HANDLE_SIZE / 2 }}
      />
      <CornerHandle
        mode="br"
        onBegin={onBeginDrag}
        style={{
          left: scx + scw - HANDLE_SIZE / 2,
          top: scy + sch - HANDLE_SIZE / 2,
        }}
      />
    </>
  );
}

function FreeOverlay({
  points,
  onClear,
  pointsCount,
}: {
  points: string[];
  onClear: () => void;
  pointsCount: number;
}) {
  const closedPath =
    pointsCount >= MIN_POLY_POINTS && points.length > 0
      ? `M${points.join(" L")} Z`
      : "";
  const openPath = points.length > 0 ? `M${points.join(" L")}` : "";

  return (
    <>
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dim outside the drawn shape, once it's closable */}
        {closedPath && (
          <>
            <defs>
              <mask id="freeMask">
                <rect width="100%" height="100%" fill="white" />
                <path d={closedPath} fill="black" />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.55)"
              mask="url(#freeMask)"
            />
          </>
        )}
        {/* Live stroke */}
        {openPath && (
          <path
            d={openPath}
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Closing segment hint */}
        {pointsCount >= MIN_POLY_POINTS && points.length > 1 && (
          <line
            x1={points[points.length - 1].split(",")[0]}
            y1={points[points.length - 1].split(",")[1]}
            x2={points[0].split(",")[0]}
            y2={points[0].split(",")[1]}
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
      </svg>

      {pointsCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="absolute top-3 right-3 h-8 px-3 rounded-pill bg-white/20 text-white text-[12px] font-semibold cursor-pointer"
        >
          Redraw
        </button>
      )}
    </>
  );
}

function CornerHandle({
  mode,
  onBegin,
  style,
}: {
  mode: DragMode;
  onBegin: (mode: DragMode, x: number, y: number) => void;
  style: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "absolute rounded-full bg-white shadow-md",
        "flex items-center justify-center cursor-pointer"
      )}
      style={{ width: HANDLE_SIZE, height: HANDLE_SIZE, ...style }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        onBegin(mode, t.clientX, t.clientY);
      }}
      onMouseDown={(e) => onBegin(mode, e.clientX, e.clientY)}
    >
      <div className="w-3 h-3 rounded-full bg-dw-fg" />
    </div>
  );
}
