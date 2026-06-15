"use client";

import { useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { cn } from "@/lib/utils";
import {
  FONT_PRESETS,
  TEXT_COLORS as COLORS,
  renderTextToDataUrl,
} from "./textEditorShared";
import ColorPickerSheet from "./ColorPickerSheet";

interface Props {
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
}

/**
 * Desktop inline text editor — used in place of the fullscreen
 * `TextModal` when there's room. Renders directly inside the
 * canvas wrapper (which is `lg:relative`) so the textarea floats
 * over the drag/drop zone and the option strip sits at the
 * bottom of the same wrapper.
 */
export default function InlineTextEditor({ onDone, onCancel }: Props) {
  const [text, setText] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [fontIdx, setFontIdx] = useState(0);
  const [previewSize, setPreviewSize] = useState(32);
  const [customColor, setCustomColor] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const font = FONT_PRESETS[fontIdx];

  async function handleAdd() {
    const url = await renderTextToDataUrl(text, font, color, previewSize);
    if (url) onDone(url);
  }

  return (
    <>
      {/* Text input floating over the canvas card */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
        <div className="bg-dw-card/95 backdrop-blur-sm rounded-card p-4 shadow-xl border border-dw-fg/10 w-[60%] max-w-[520px] min-h-[140px] flex items-center justify-center pointer-events-auto">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type something…"
            rows={3}
            autoFocus
            className="w-full bg-transparent border-none outline-none resize-none text-center"
            style={{
              color,
              fontWeight: font.weight,
              fontStyle: font.style,
              fontFamily: font.cssFamily,
              fontSize: previewSize,
              lineHeight: 1.15,
              WebkitTextStroke:
                color === "#ffffff" || color === "#fdd835"
                  ? "1px #232220"
                  : undefined,
            }}
          />
        </div>
      </div>

      {/* Vertical font-size slider on the right edge of the wrapper */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 h-[50%] z-30 flex items-center justify-center pointer-events-none">
        <input
          type="range"
          min={12}
          max={48}
          step={1}
          value={previewSize}
          onChange={(e) => setPreviewSize(Number(e.target.value))}
          aria-label="Font size"
          className="font-size-slider-light pointer-events-auto"
        />
      </div>

      {/* Floating option strip at the bottom of the drag/drop zone */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 w-[60%] max-w-[520px] flex flex-col gap-2 items-center bg-dw-card/95 backdrop-blur-sm rounded-card px-4 py-3 shadow-xl border border-dw-fg/10 pointer-events-auto">
        {/* Font picker */}
        <div className="flex gap-2 items-center">
          {FONT_PRESETS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFontIdx(i)}
              className={cn(
                "h-8 px-3 rounded-pill text-[12px] font-semibold cursor-pointer shrink-0",
                fontIdx === i
                  ? "bg-dw-fg text-dw-bg"
                  : "border border-dw-fg/20 text-dw-fg"
              )}
              style={{ fontFamily: f.cssFamily, fontStyle: f.style }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <div className="flex gap-1.5 items-center">
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
            onClick={() => setShowColorPicker(true)}
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

        {/* Buttons */}
        <div className="flex gap-2 w-full pt-1">
          <OutlineButton onClick={onCancel} className="flex-1 !h-9 !text-[13px]">
            Cancel
          </OutlineButton>
          <PrimaryButton
            onClick={handleAdd}
            disabled={!text.trim()}
            className="flex-1 !h-9 !text-[13px]"
          >
            Add
          </PrimaryButton>
        </div>
      </div>

      {showColorPicker && (
        <ColorPickerSheet
          variant="centered"
          initial={color}
          onPick={(hex) => {
            setCustomColor(hex);
            setColor(hex);
            setShowColorPicker(false);
          }}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </>
  );
}
