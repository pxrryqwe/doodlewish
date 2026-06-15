"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CUSTOM_CATEGORY } from "@/lib/customStickers";
import ColorPickerSheet from "./ColorPickerSheet";

const DOT_ART_CATEGORY = "Dot Art";
const DOT_COLORS = [
  "#232220",
  "#ef5a5f",
  "#ffb74d",
  "#fdd835",
  "#66bb6a",
  "#42a5f5",
  "#ab47bc",
  "#ffffff",
];

/**
 * Recolor a raster image (any non-transparent pixel becomes `hex`),
 * preserving the original alpha so anti-aliased edges still look smooth.
 * Returns a PNG data URL.
 */
async function recolorRaster(src: string, hex: string): Promise<string> {
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  for (let i = 0; i < data.data.length; i += 4) {
    if (data.data[i + 3] > 0) {
      data.data[i] = r;
      data.data[i + 1] = g;
      data.data[i + 2] = b;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL("image/png");
}

interface Sticker {
  id: string;
  image_url: string;
  category: string;
}

interface Props {
  stickers: Sticker[];
  onStickerSelect: (imageUrl: string) => void;
  onUpload?: (file: File) => void | Promise<void>;
  onAddText?: () => void;
  onAddDrawing?: () => void;
  /** "default" = mobile bottom sheet; "responsive" = bottom sheet on mobile,
   *  vertical sidebar on lg+. */
  variant?: "default" | "responsive";
  /** Permanently delete a custom sticker by id. Used by Manage mode. */
  onDeleteCustom?: (stickerId: string) => void;
  /** Called with pointer client coords during a custom-tile drag. */
  onCustomDragStart?: () => void;
  onCustomDragMove?: (clientX: number, clientY: number) => void;
  /** Called on drag end. Returns true if the tile was dropped over the trash. */
  onCustomDragEnd?: (
    stickerId: string,
    clientX: number,
    clientY: number
  ) => boolean;
}

const SWIPE_THRESHOLD = 30;
const COLLAPSED_HEIGHT = 138;

export default function StickerTray({
  stickers,
  onStickerSelect,
  onUpload,
  onAddText,
  onAddDrawing,
  variant = "default",
  onDeleteCustom,
  onCustomDragStart,
  onCustomDragMove,
  onCustomDragEnd,
}: Props) {
  const isResponsive = variant === "responsive";
  const [manageMode, setManageMode] = useState(false);
  const [dotColor, setDotColor] = useState(DOT_COLORS[0]);
  const [customDotColor, setCustomDotColor] = useState<string | null>(null);
  const [showDotColorPicker, setShowDotColorPicker] = useState(false);
  // Pin "My stickers" first, then the rest in source order.
  const allCategories = Array.from(new Set(stickers.map((s) => s.category)));
  const categories = [
    CUSTOM_CATEGORY,
    ...allCategories.filter((c) => c !== CUSTOM_CATEGORY),
  ];
  const [activeCategory, setActiveCategory] = useState(categories[0] ?? "");
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const touchStartY = useRef<number | null>(null);
  const filtered = stickers.filter((s) => s.category === activeCategory);
  const isCustomView = activeCategory === CUSTOM_CATEGORY;
  const isDotArtView = activeCategory === DOT_ART_CATEGORY;
  const hasCustomStickers = isCustomView && filtered.length > 0;

  // For dot-art stickers, recolor the source raster with the chosen tint
  // before handing it to the canvas. Other stickers pass through untouched.
  async function handlePick(sticker: Sticker) {
    if (sticker.category === DOT_ART_CATEGORY) {
      try {
        const recolored = await recolorRaster(sticker.image_url, dotColor);
        onStickerSelect(recolored);
        return;
      } catch {
        // fall through and use the original
      }
    }
    onStickerSelect(sticker.image_url);
  }

  // Leave manage mode automatically when:
  //  - the user switches categories
  //  - the last custom sticker is deleted
  useEffect(() => {
    if (!isCustomView || filtered.length === 0) setManageMode(false);
  }, [isCustomView, filtered.length]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (dy < -SWIPE_THRESHOLD) setExpanded(true);
    else if (dy > SWIPE_THRESHOLD) setExpanded(false);
  }

  // For 2-row layout: even-indexed go to top row, odd-indexed to bottom.
  const rowA: Sticker[] = filtered.filter((_, i) => i % 2 === 0);
  const rowB: Sticker[] = filtered.filter((_, i) => i % 2 === 1);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onUpload) onUpload(file);
    // Reset so the same file can be picked again.
    e.target.value = "";
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  return (
    <div
      className={cn(
        "relative h-[138px]",
        isResponsive &&
          "lg:h-full lg:bg-dw-tray lg:rounded-card lg:overflow-hidden lg:flex lg:flex-col"
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20",
          "bg-dw-tray border-t border-dw-fg/20 pt-1.5 pb-1.5",
          "shadow-[0_-8px_24px_rgba(0,0,0,0.04)]",
          isResponsive &&
            "lg:static lg:inset-auto lg:z-auto lg:border-t-0 lg:shadow-none lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:pt-3"
        )}
      >
        {/* Drag handle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Show fewer stickers" : "Show more stickers"}
          className={cn(
            "flex justify-center w-full mb-1 py-1.5 cursor-pointer",
            isResponsive && "lg:hidden"
          )}
        >
          <div className="w-[39px] h-[4px] bg-dw-fg/40 rounded-pill" />
        </button>

        {/* Category chips */}
        <div className={cn(
          "flex gap-2 px-5 mb-2.5 overflow-x-auto no-scrollbar",
          isResponsive && "lg:flex-wrap lg:overflow-x-visible"
        )}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "py-1.5 px-3 rounded-pill text-[12px] font-medium shrink-0 cursor-pointer",
                activeCategory === cat
                  ? "bg-dw-fg text-dw-bg"
                  : "border border-dw-fg/20 text-dw-fg"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dot Art color picker — only visible when the Dot Art tab is active */}
        {isDotArtView && (
          <div className="flex items-center gap-1.5 px-5 mb-2 overflow-x-auto no-scrollbar">
            <span className="text-[11px] text-dw-gray font-medium shrink-0 mr-1">
              Color
            </span>
            {DOT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDotColor(c)}
                aria-label={`Dot art color ${c}`}
                className={cn(
                  "w-6 h-6 rounded-full shrink-0 border-2 cursor-pointer",
                  dotColor === c ? "border-dw-fg" : "border-dw-fg/15"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            {customDotColor && !DOT_COLORS.includes(customDotColor) && (
              <button
                type="button"
                onClick={() => setDotColor(customDotColor)}
                aria-label={`Custom color ${customDotColor}`}
                className={cn(
                  "w-6 h-6 rounded-full shrink-0 border-2 cursor-pointer",
                  dotColor === customDotColor ? "border-dw-fg" : "border-dw-fg/15"
                )}
                style={{ backgroundColor: customDotColor }}
              />
            )}
            <button
              type="button"
              onClick={() => setShowDotColorPicker(true)}
              aria-label="Pick a custom color"
              className="w-6 h-6 rounded-full shrink-0 border-2 border-dw-fg/30 cursor-pointer relative overflow-hidden"
              style={{
                background:
                  "conic-gradient(from 0deg, #ff5a5f, #ffb74d, #fdd835, #66bb6a, #42a5f5, #ab47bc, #ef5a5f)",
              }}
            >
              <span className="absolute inset-[3px] rounded-full bg-white/90 flex items-center justify-center text-dw-fg text-[10px] font-bold leading-none">
                +
              </span>
            </button>
          </div>
        )}

        {/* Sticker rows */}
        <div className={cn(
          "overflow-x-auto no-scrollbar",
          isResponsive && "lg:overflow-x-hidden lg:overflow-y-auto lg:flex-1 lg:min-h-0"
        )}>
          {/* py-1.5 gives the active-state ring/badge room to render at the
              top + bottom of each tile without being clipped. (Setting
              overflow-x on the parent forces overflow-y to clip too.) */}
          <div className="flex flex-col gap-[8px] px-6 py-1.5">
            <Row
              stickers={isResponsive ? filtered : expanded ? rowA : filtered}
              onPick={handlePick}
              isCustomView={isCustomView}
              showCreatorTiles={isCustomView}
              hasCustomStickers={hasCustomStickers}
              manageMode={manageMode}
              onToggleManage={() => setManageMode((v) => !v)}
              onAddPhoto={openPicker}
              onAddText={onAddText}
              onAddDrawing={onAddDrawing}
              onDeleteCustom={onDeleteCustom}
              onCustomDragStart={onCustomDragStart}
              onCustomDragMove={onCustomDragMove}
              onCustomDragEnd={onCustomDragEnd}
              wrap={isResponsive}
            />
            {!isResponsive && expanded && rowB.length > 0 && (
              <Row
                stickers={rowB}
                onPick={handlePick}
                isCustomView={isCustomView}
                manageMode={manageMode}
                onDeleteCustom={onDeleteCustom}
                onCustomDragStart={onCustomDragStart}
                onCustomDragMove={onCustomDragMove}
                onCustomDragEnd={onCustomDragEnd}
              />
            )}
          </div>
        </div>
      </div>

      {showDotColorPicker && (
        <ColorPickerSheet
          initial={dotColor}
          onPick={(hex) => {
            setCustomDotColor(hex);
            setDotColor(hex);
            setShowDotColorPicker(false);
          }}
          onClose={() => setShowDotColorPicker(false)}
        />
      )}
    </div>
  );
}

function Row({
  stickers,
  onPick,
  isCustomView,
  showCreatorTiles,
  hasCustomStickers,
  manageMode,
  onToggleManage,
  onAddPhoto,
  onAddText,
  onAddDrawing,
  onDeleteCustom,
  onCustomDragStart,
  onCustomDragMove,
  onCustomDragEnd,
  wrap,
}: {
  stickers: Sticker[];
  onPick: (sticker: Sticker) => void;
  isCustomView: boolean;
  showCreatorTiles?: boolean;
  hasCustomStickers?: boolean;
  manageMode?: boolean;
  onToggleManage?: () => void;
  onAddPhoto?: () => void;
  onAddText?: () => void;
  onAddDrawing?: () => void;
  onDeleteCustom?: (id: string) => void;
  onCustomDragStart?: () => void;
  onCustomDragMove?: (clientX: number, clientY: number) => void;
  onCustomDragEnd?: (
    stickerId: string,
    clientX: number,
    clientY: number
  ) => boolean;
  wrap?: boolean;
}) {
  return (
    <div className={cn("flex gap-[8px]", wrap && "lg:grid lg:grid-cols-3 lg:gap-2 lg:justify-items-center")}>
      {showCreatorTiles && !manageMode && (
        <>
          <CreatorTile label="Upload a photo sticker" caption="Photo" onClick={onAddPhoto}>
            <PlusIcon />
          </CreatorTile>
          <CreatorTile label="Add text sticker" caption="Text" onClick={onAddText}>
            <span className="font-extrabold text-[22px] lg:text-[28px] text-dw-fg leading-none flex items-center justify-center w-[22px] h-[22px] lg:w-[28px] lg:h-[28px]">
              T
            </span>
          </CreatorTile>
          <CreatorTile label="Draw a sticker" caption="Draw" onClick={onAddDrawing}>
            <BrushIcon />
          </CreatorTile>
        </>
      )}
      {showCreatorTiles && manageMode && (
        <button
          type="button"
          onClick={onToggleManage}
          aria-label="Done managing"
          className="h-[51px] px-3 shrink-0 bg-dw-fg text-white rounded-card text-[13px] font-semibold cursor-pointer"
        >
          Done
        </button>
      )}
      {stickers.map((sticker) => (
        <Tile
          key={sticker.id}
          sticker={sticker}
          isCustom={isCustomView}
          manageMode={manageMode}
          onDelete={onDeleteCustom}
          onEnterManageMode={onToggleManage}
          onPick={() => onPick(sticker)}
          onCustomDragStart={onCustomDragStart}
          onCustomDragMove={onCustomDragMove}
          onCustomDragEnd={onCustomDragEnd}
        />
      ))}
    </div>
  );
}

function CreatorTile({
  label,
  caption,
  onClick,
  children,
}: {
  label: string;
  caption?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-[51px] h-[51px] lg:w-[88px] lg:h-[88px] shrink-0 bg-dw-bg rounded-card flex flex-col items-center justify-center gap-0 lg:gap-1.5 overflow-hidden cursor-pointer border border-dashed border-dw-fg/40"
    >
      <span className="flex items-center justify-center w-[22px] h-[22px] lg:w-[28px] lg:h-[28px]">
        {children}
      </span>
      {caption && (
        <span className="hidden lg:block text-[14px] font-semibold text-dw-fg leading-none">
          {caption}
        </span>
      )}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-dw-fg w-[22px] h-[22px] lg:w-[28px] lg:h-[28px]"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function BrushIcon() {
  return (
    <img
      src="/brush.svg"
      alt=""
      aria-hidden
      draggable={false}
      className="w-[22px] h-[22px] lg:w-[28px] lg:h-[28px] pointer-events-none select-none"
    />
  );
}


// Long-press duration that flips the tray into manage mode.
const LONG_PRESS_MS = 600;

function Tile({
  sticker,
  isCustom,
  manageMode,
  onPick,
  onDelete,
  onEnterManageMode,
  onCustomDragStart,
  onCustomDragMove,
  onCustomDragEnd,
}: {
  sticker: Sticker;
  isCustom: boolean;
  manageMode?: boolean;
  onPick: () => void;
  onDelete?: (id: string) => void;
  onEnterManageMode?: () => void;
  onCustomDragStart?: () => void;
  onCustomDragMove?: (clientX: number, clientY: number) => void;
  onCustomDragEnd?: (
    stickerId: string,
    clientX: number,
    clientY: number
  ) => boolean;
}) {
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const draggingRef = useRef(false);
  // True for a short window after touchend so the synthetic click event
  // that follows is ignored (otherwise tapping fires onPick twice).
  const touchHandledRef = useRef(false);
  // setTimeout id for the long-press detector. Set on touchstart, cleared
  // on touchmove (if dragging), touchend, or touchcancel.
  const holdTimerRef = useRef<number | null>(null);
  const heldRef = useRef(false);

  const inManage = !!manageMode && isCustom;

  function clearHoldTimer() {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }

  function startHoldTimer() {
    clearHoldTimer();
    heldRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      heldRef.current = true;
      holdTimerRef.current = null;
      // Haptic feedback if available
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          (navigator as Navigator & { vibrate?: (ms: number) => void }).vibrate?.(
            20
          );
        }
      } catch {}
      onEnterManageMode?.();
    }, LONG_PRESS_MS);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!isCustom || inManage) return;
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    draggingRef.current = false;
    startHoldTimer();
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isCustom || inManage || !startRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    if (!draggingRef.current && Math.hypot(dx, dy) > 6) {
      draggingRef.current = true;
      clearHoldTimer(); // movement means it's a drag, not a hold
      onCustomDragStart?.();
    }
    if (draggingRef.current) {
      e.preventDefault();
      onCustomDragMove?.(t.clientX, t.clientY);
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!isCustom || inManage || !startRef.current) return;
    const t = e.changedTouches[0];
    const wasDragging = draggingRef.current;
    const wasHeld = heldRef.current;
    draggingRef.current = false;
    heldRef.current = false;
    clearHoldTimer();
    startRef.current = null;
    if (wasDragging) {
      onCustomDragEnd?.(sticker.id, t.clientX, t.clientY);
    } else if (!wasHeld) {
      // A clean tap → drop on the canvas. If the hold timer already fired
      // (manage mode now on) we don't drop.
      onPick();
    }
    touchHandledRef.current = true;
    setTimeout(() => {
      touchHandledRef.current = false;
    }, 400);
  }

  function onTouchCancel() {
    clearHoldTimer();
    draggingRef.current = false;
    heldRef.current = false;
    startRef.current = null;
  }

  function onClick() {
    if (inManage) {
      // Tile click in manage mode acts like the delete badge.
      onDelete?.(sticker.id);
      return;
    }
    if (touchHandledRef.current) return;
    if (draggingRef.current) return;
    if (heldRef.current) {
      heldRef.current = false;
      return;
    }
    onPick();
  }

  // Desktop fallback — Mouse long-press
  function onMouseDown() {
    if (!isCustom || inManage) return;
    startHoldTimer();
  }
  function onMouseUp() {
    clearHoldTimer();
  }
  function onMouseLeave() {
    clearHoldTimer();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        // Disable iOS long-press selection / Copy-Look Up callout on the tile.
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        userSelect: "none",
      }}
      className={cn(
        "relative w-[51px] h-[51px] lg:w-[88px] lg:h-[88px] shrink-0 bg-dw-bg rounded-card flex items-center justify-center overflow-hidden cursor-pointer transition select-none",
        // Inset outline (no offset) so the active ring never falls outside
        // the tile and gets clipped by the horizontally-scrolling parent.
        inManage && "outline outline-2 -outline-offset-2 outline-red-400/80"
      )}
    >
      <img
        src={sticker.image_url}
        alt=""
        draggable={false}
        className="w-[78%] h-[78%] object-contain pointer-events-none select-none"
        style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
      />
      {inManage && (
        // X badge sits INSIDE the tile so it's never clipped by the
        // horizontally-scrolling parent row.
        <span
          aria-hidden
          style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
          className="absolute top-0.5 right-0.5 w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[12px] font-bold leading-none flex items-center justify-center shadow select-none pointer-events-none"
        >
          ×
        </span>
      )}
    </button>
  );
}
