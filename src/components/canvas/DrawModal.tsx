"use client";

import { useEffect, useRef, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { cn } from "@/lib/utils";
import ColorPickerSheet from "./ColorPickerSheet";
import { drawCrayonSegment, drawCrayonDot } from "./crayonBrush";

interface Props {
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 720;
const COLORS = [
  "#232220",
  "#ef5a5f",
  "#ffb74d",
  "#fdd835",
  "#66bb6a",
  "#42a5f5",
  "#ab47bc",
  "#ffffff",
];
const BRUSH_SIZES = [6, 14, 28];
const MAX_HISTORY = 30;

type Tool = "brush" | "eraser";

export default function DrawModal({ onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [tool, setTool] = useState<Tool>("brush");
  const [showPicker, setShowPicker] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [, force] = useState(0);
  const rerender = () => force((v) => v + 1);

  function pickCustomColor(hex: string) {
    setCustomColor(hex);
    setColor(hex);
    setShowPicker(false);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Start with an empty (transparent) canvas state in history.
    historyRef.current = [ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)];
    rerender();
  }, []);

  function getPos(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      if (!t) return null;
      clientX = t.clientX;
      clientY = t.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  }

  function pushHistory() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    historyRef.current.push(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE));
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    }
  }

  function applyToolMode(ctx: CanvasRenderingContext2D) {
    // "destination-out" makes new strokes erase existing pixels instead of
    // adding them — a real eraser, not a white brush.
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
  }

  function start(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) {
    const pos = getPos(e);
    if (!pos) return;
    pushHistory();
    drawingRef.current = pos;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    applyToolMode(ctx);
    ctx.fillStyle = color;
    if (tool === "eraser") {
      // Tap = single erased dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawCrayonDot(ctx, pos.x, pos.y, brushSize);
    }
  }

  function move(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) {
    if (!drawingRef.current) return;
    if ("touches" in e) e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    applyToolMode(ctx);
    if (tool === "eraser") {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.x, drawingRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      drawCrayonSegment(
        ctx,
        drawingRef.current.x,
        drawingRef.current.y,
        pos.x,
        pos.y,
        brushSize
      );
    }
    drawingRef.current = pos;
  }

  function end() {
    drawingRef.current = null;
    rerender(); // updates undo/done button states
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const last = historyRef.current[historyRef.current.length - 1];
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last) return;
    ctx.putImageData(last, 0, 0);
    rerender();
  }

  function doClear() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    historyRef.current = [ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)];
    rerender();
  }

  function isCanvasEmpty(): boolean {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return true;
    const img = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    for (let i = 3; i < img.data.length; i += 4) {
      if (img.data[i] !== 0) return false;
    }
    return true;
  }

  function requestClear() {
    if (isCanvasEmpty()) return;
    setShowClearConfirm(true);
  }

  function done() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    // Find non-transparent bounding box
    let minX = CANVAS_SIZE,
      minY = CANVAS_SIZE,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < CANVAS_SIZE; y++) {
      for (let x = 0; x < CANVAS_SIZE; x++) {
        const alpha = img.data[(y * CANVAS_SIZE + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) {
      // Nothing drawn
      onCancel();
      return;
    }
    const pad = 16;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(CANVAS_SIZE - 1, maxX + pad);
    maxY = Math.min(CANVAS_SIZE - 1, maxY + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    if (!octx) return;
    octx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
    onDone(out.toDataURL("image/png"));
  }

  const canUndo = historyRef.current.length > 1;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div
        className="text-white text-center font-semibold text-[16px] shrink-0 pt-3 pb-2 select-none"
        style={{
          paddingTop: "max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
      >
        Draw your sticker
      </div>

      <div className="flex-1 flex items-center justify-center px-5">
        <canvas
          ref={canvasRef}
          className="bg-[#FAF8F6] rounded-card touch-none cursor-crosshair select-none"
          style={{
            width: "min(100%, 480px)",
            aspectRatio: "1",
            maxHeight: "60vh",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
          onTouchCancel={end}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
        />
      </div>

      {/* Color picker */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto justify-start no-scrollbar items-center">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            className={cn(
              "w-9 h-9 rounded-full shrink-0 border-2 cursor-pointer",
              color === c ? "border-white" : "border-white/20"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Custom-picked color (remembered until a new one is chosen) */}
        {customColor && !COLORS.includes(customColor) && (
          <button
            type="button"
            onClick={() => setColor(customColor)}
            aria-label={`Custom color ${customColor}`}
            className={cn(
              "w-9 h-9 rounded-full shrink-0 border-2 cursor-pointer",
              color === customColor ? "border-white" : "border-white/20"
            )}
            style={{ backgroundColor: customColor }}
          />
        )}
        {/* Custom color picker trigger (rainbow ring) */}
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          aria-label="Pick a custom color"
          className="w-9 h-9 rounded-full shrink-0 border-2 border-white/40 cursor-pointer relative overflow-hidden"
          style={{
            background:
              "conic-gradient(from 0deg, #ff5a5f, #ffb74d, #fdd835, #66bb6a, #42a5f5, #ab47bc, #ef5a5f)",
          }}
        >
          <span className="absolute inset-[5px] rounded-full bg-black/30 flex items-center justify-center text-white text-[14px] font-bold leading-none">
            +
          </span>
        </button>
      </div>

      {/* Toolbar — two clean rows */}
      <div className="px-5 py-2 flex flex-col gap-2 select-none">
        {/* Row 1: tool toggle + brush sizes */}
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setTool("brush")}
            aria-label="Brush"
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer",
              tool === "brush" ? "border-white bg-white/10" : "border-white/20"
            )}
          >
            <BrushIcon active={tool === "brush"} />
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            aria-label="Eraser"
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer",
              tool === "eraser" ? "border-white bg-white/10" : "border-white/20"
            )}
          >
            <EraserIcon active={tool === "eraser"} />
          </button>

          <div className="w-px h-6 bg-white/30 mx-2" />

          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setBrushSize(s)}
              aria-label={`Brush size ${s}`}
              className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer",
                brushSize === s ? "border-white bg-white/10" : "border-white/20"
              )}
            >
              <div
                className="rounded-full bg-white"
                style={{ width: s, height: s }}
              />
            </button>
          ))}
        </div>

        {/* Row 2: actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="h-10 px-5 rounded-pill border-2 border-white/30 text-white text-[13px] font-semibold disabled:opacity-40 cursor-pointer flex items-center gap-2"
          >
            <UndoIcon />
            Undo
          </button>
          <button
            type="button"
            onClick={requestClear}
            className="h-10 px-5 rounded-pill border-2 border-white/30 text-white text-[13px] font-semibold cursor-pointer flex items-center gap-2"
          >
            <TrashIcon />
            Clear
          </button>
        </div>
      </div>

      <div
        className="px-5 pt-3 flex gap-3 bg-black shrink-0"
        style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
      >
        <OutlineButton
          onClick={onCancel}
          className="flex-1 !text-white !border-white/40"
        >
          Cancel
        </OutlineButton>
        <PrimaryButton
          onClick={done}
          className="flex-1 !bg-white !text-black"
        >
          Use this
        </PrimaryButton>
      </div>

      {showPicker && (
        <ColorPickerSheet
          initial={customColor ?? color}
          onPick={pickCustomColor}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear drawing?"
          message="This will erase everything you’ve drawn so far."
          confirmLabel="Yes, clear"
          cancelLabel="No, keep"
          onConfirm={() => {
            setShowClearConfirm(false);
            doClear();
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}

function BrushIcon({ active }: { active: boolean }) {
  return (
    <img
      src="/brush.svg"
      alt=""
      aria-hidden
      draggable={false}
      className="w-5 h-5 pointer-events-none select-none"
      style={{
        // The SVG itself is drawn in black; on the dark draw modal we lift
        // it to white via invert and dim it when the eraser is active.
        filter: "invert(1) brightness(2)",
        opacity: active ? 1 : 0.6,
      }}
    />
  );
}

function EraserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "#ffffff" : "rgba(255,255,255,0.6)"}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 3 L21 8 L10 19 L3 19 L3 14 Z" />
      <path d="M9 19 L18 10" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 13 L3 7 L9 1" />
      <path d="M3 7 L15 7 C19 7 22 10 22 14 C22 18 19 21 15 21 L10 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6 L21 6" />
      <path d="M8 6 V4 a2 2 0 0 1 2 -2 h4 a2 2 0 0 1 2 2 V6" />
      <path d="M19 6 L18 20 a2 2 0 0 1 -2 2 H8 a2 2 0 0 1 -2 -2 L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center px-6"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-card w-full max-w-[340px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-bold text-[18px] text-dw-fg text-center">{title}</p>
        <p className="text-[13px] text-dw-gray text-center mt-2 mb-4">
          {message}
        </p>
        <div className="flex gap-3">
          <OutlineButton onClick={onCancel} className="flex-1">
            {cancelLabel}
          </OutlineButton>
          <PrimaryButton onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

