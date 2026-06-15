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

export default function TextModal({ onDone, onCancel }: Props) {
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
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
      <div
        className="text-white text-center font-semibold text-[16px] shrink-0 pt-3 pb-2"
        style={{ paddingTop: "max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        Add text
      </div>

      <div className="flex-1 flex items-center justify-center px-5 relative">
        <div className="w-full bg-dw-card rounded-card p-4 flex items-center justify-center min-h-[180px]">
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

        {/* Vertical font-size slider (Instagram-style) */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 h-[60%] flex items-center justify-center pointer-events-none">
          <input
            type="range"
            min={12}
            max={48}
            step={1}
            value={previewSize}
            onChange={(e) => setPreviewSize(Number(e.target.value))}
            aria-label="Font size"
            className="font-size-slider pointer-events-auto"
          />
        </div>
      </div>

      {/* Font picker (horizontally scrollable on small phones) */}
      <div className="px-5 pt-2 pb-1 flex gap-2 justify-start sm:justify-center overflow-x-auto no-scrollbar">
        {FONT_PRESETS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFontIdx(i)}
            className={cn(
              "h-9 px-4 rounded-pill text-[13px] font-semibold cursor-pointer shrink-0",
              fontIdx === i ? "bg-white text-black" : "bg-white/15 text-white"
            )}
            style={{ fontFamily: f.cssFamily, fontStyle: f.style }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Color picker */}
      <div className="px-5 py-3 flex gap-2 overflow-x-auto justify-center no-scrollbar">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Color ${c}`}
            className={cn(
              "w-10 h-10 rounded-full shrink-0 border-2 cursor-pointer",
              color === c ? "border-white" : "border-white/20"
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
              "w-10 h-10 rounded-full shrink-0 border-2 cursor-pointer",
              color === customColor ? "border-white" : "border-white/20"
            )}
            style={{ backgroundColor: customColor }}
          />
        )}
        <button
          type="button"
          onClick={() => setShowColorPicker(true)}
          aria-label="Pick a custom color"
          className="w-10 h-10 rounded-full shrink-0 border-2 border-white/30 cursor-pointer relative overflow-hidden"
          style={{
            background:
              "conic-gradient(from 0deg, #ff5a5f, #ffb74d, #fdd835, #66bb6a, #42a5f5, #ab47bc, #ef5a5f)",
          }}
        >
          <span className="absolute inset-[4px] rounded-full bg-white/90 flex items-center justify-center text-dw-fg text-[13px] font-bold leading-none">
            +
          </span>
        </button>
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
          onClick={handleAdd}
          disabled={!text.trim()}
          className="flex-1 !bg-white !text-black"
        >
          Add
        </PrimaryButton>
      </div>

      {showColorPicker && (
        <ColorPickerSheet
          initial={color}
          onPick={(hex) => {
            setCustomColor(hex);
            setColor(hex);
            setShowColorPicker(false);
          }}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
