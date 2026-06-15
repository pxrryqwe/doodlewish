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

// Render at 2x the mobile DrawModal's resolution. Desktop has more room
// to enlarge a drawn sticker after dropping, so a higher source res
// keeps it crisp when the user scales it up.
const CANVAS_SIZE = 1440;
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
// Brush sizes are in canvas-coordinate pixels; doubled to match the
// 2x CANVAS_SIZE so a stroke "feels" the same thickness on screen.
const BRUSH_SIZES = [12, 28, 56];
const MAX_HISTORY = 30;

type Tool = "brush" | "eraser";

/**
 * Desktop inline draw editor — mirrors `DrawModal` (mobile) but renders
 * inside the drag/drop zone instead of a fullscreen overlay. Canvas
 * floats over the drop zone; the toolbar + actions sit in an option
 * panel matched to the canvas width at the bottom of the wrapper.
 */
export default function InlineDrawEditor({ onDone, onCancel }: Props) {
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
    historyRef.current = [ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)];
    rerender();
  }, []);

  function getPos(
    e:
      | React.TouchEvent<HTMLCanvasElement>
      | React.MouseEvent<HTMLCanvasElement>
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
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
  }

  function applyToolMode(ctx: CanvasRenderingContext2D) {
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
  }

  function start(
    e:
      | React.TouchEvent<HTMLCanvasElement>
      | React.MouseEvent<HTMLCanvasElement>
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
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawCrayonDot(ctx, pos.x, pos.y, brushSize);
    }
  }

  function move(
    e:
      | React.TouchEvent<HTMLCanvasElement>
      | React.MouseEvent<HTMLCanvasElement>
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
    rerender();
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
    <>
      {/* Drawing canvas floating in the center of the drop zone */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        <div className="bg-dw-card/95 backdrop-blur-sm rounded-card p-3 shadow-xl border border-dw-fg/10 w-[60%] max-w-[520px] pointer-events-auto">
          <canvas
            ref={canvasRef}
            className="bg-[#FAF8F6] rounded-card touch-none cursor-crosshair select-none w-full"
            style={{
              aspectRatio: "1",
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
      </div>

      {/* Floating option panel at the bottom of the drop zone */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-[60%] max-w-[520px] flex flex-col gap-2 items-stretch bg-dw-card/95 backdrop-blur-sm rounded-card px-4 py-3 shadow-xl border border-dw-fg/10 pointer-events-auto">
        {/* Colors */}
        <div className="flex gap-1.5 items-center justify-center flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={cn(
                "w-7 h-7 rounded-full shrink-0 border-2 cursor-pointer",
                color === c ? "border-dw-fg" : "border-dw-fg/15"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          {customColor && !COLORS.includes(customColor) && (
            <button
              type="button"
              onClick={() => setColor(customColor)}
              aria-label={`Custom color ${customColor}`}
              className={cn(
                "w-7 h-7 rounded-full shrink-0 border-2 cursor-pointer",
                color === customColor ? "border-dw-fg" : "border-dw-fg/15"
              )}
              style={{ backgroundColor: customColor }}
            />
          )}
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            aria-label="Pick a custom color"
            className="w-7 h-7 rounded-full shrink-0 border-2 border-dw-fg/30 cursor-pointer relative overflow-hidden"
            style={{
              background:
                "conic-gradient(from 0deg, #ff5a5f, #ffb74d, #fdd835, #66bb6a, #42a5f5, #ab47bc, #ef5a5f)",
            }}
          >
            <span className="absolute inset-[3px] rounded-full bg-white/90 flex items-center justify-center text-dw-fg text-[11px] font-bold leading-none">
              +
            </span>
          </button>
        </div>

        {/* Tools + brush sizes */}
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => setTool("brush")}
            aria-label="Brush"
            className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer",
              tool === "brush"
                ? "border-dw-fg bg-dw-fg/10"
                : "border-dw-fg/20"
            )}
          >
            <BrushIcon active={tool === "brush"} />
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            aria-label="Eraser"
            className={cn(
              "w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer",
              tool === "eraser"
                ? "border-dw-fg bg-dw-fg/10"
                : "border-dw-fg/20"
            )}
          >
            <EraserIcon active={tool === "eraser"} />
          </button>
          <div className="w-px h-5 bg-dw-fg/20 mx-1" />
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setBrushSize(s)}
              aria-label={`Brush size ${s}`}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer",
                brushSize === s
                  ? "border-dw-fg bg-dw-fg/10"
                  : "border-dw-fg/20"
              )}
            >
              <div
                className="rounded-full bg-dw-fg"
                style={{
                  width: Math.min(s, 18),
                  height: Math.min(s, 18),
                }}
              />
            </button>
          ))}
          <div className="w-px h-5 bg-dw-fg/20 mx-1" />
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            className="w-8 h-8 rounded-full border-2 border-dw-fg/20 text-dw-fg disabled:opacity-40 cursor-pointer flex items-center justify-center"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={requestClear}
            aria-label="Clear"
            className="w-8 h-8 rounded-full border-2 border-dw-fg/20 text-dw-fg cursor-pointer flex items-center justify-center"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Cancel / Use */}
        <div className="flex gap-2 w-full pt-1">
          <OutlineButton
            onClick={onCancel}
            className="flex-1 !h-9 !text-[13px]"
          >
            Cancel
          </OutlineButton>
          <PrimaryButton onClick={done} className="flex-1 !h-9 !text-[13px]">
            Use this
          </PrimaryButton>
        </div>
      </div>

      {showPicker && (
        <ColorPickerSheet
          variant="centered"
          initial={customColor ?? color}
          onPick={pickCustomColor}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showClearConfirm && (
        <ConfirmDialog
          title="Clear drawing?"
          message="This will erase everything you've drawn so far."
          confirmLabel="Yes, clear"
          cancelLabel="No, keep"
          onConfirm={() => {
            setShowClearConfirm(false);
            doClear();
          }}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </>
  );
}

function BrushIcon({ active }: { active: boolean }) {
  return (
    <img
      src="/brush.svg"
      alt=""
      aria-hidden
      draggable={false}
      className="w-4 h-4 pointer-events-none select-none"
      style={{ opacity: active ? 1 : 0.5 }}
    />
  );
}

function EraserIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "currentColor" : "rgba(35,34,32,0.5)"}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-dw-fg"
    >
      <path d="M16 3 L21 8 L10 19 L3 19 L3 14 Z" />
      <path d="M9 19 L18 10" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="14"
      height="14"
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
      width="14"
      height="14"
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
