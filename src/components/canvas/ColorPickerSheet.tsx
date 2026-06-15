"use client";

import { useEffect, useRef, useState } from "react";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { cn } from "@/lib/utils";

interface Props {
  initial: string;
  onPick: (hex: string) => void;
  onClose: () => void;
  /** "sheet" = bottom sheet (mobile default), "centered" = centered floating
   *  panel with a close button (desktop). */
  variant?: "sheet" | "centered";
}

export default function ColorPickerSheet({
  initial,
  onPick,
  onClose,
  variant = "sheet",
}: Props) {
  const [h0, s0, l0] = hexToHsl(initial);
  const [h, setH] = useState(h0);
  const [s, setS] = useState(s0);
  const [l, setL] = useState(l0);
  const [mode, setMode] = useState<"panel" | "sliders">("panel");
  const [hexInput, setHexInput] = useState(initial.toUpperCase());

  const preview = `hsl(${h} ${s}% ${l}%)`;
  const previewHex = hslToHex(h, s, l).toUpperCase();

  useEffect(() => {
    setHexInput(previewHex);
  }, [previewHex]);

  function handleHexChange(value: string) {
    setHexInput(value);
    const cleaned = value.trim().replace(/^#?/, "#");
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      const [nh, ns, nl] = hexToHsl(cleaned);
      setH(nh);
      setS(ns);
      setL(nl);
    } else if (/^#[0-9a-fA-F]{3}$/.test(cleaned)) {
      const ex = `#${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}${cleaned[3]}${cleaned[3]}`;
      const [nh, ns, nl] = hexToHsl(ex);
      setH(nh);
      setS(ns);
      setL(nl);
    }
  }

  const [hsvH, hsvS, hsvV] = hslToHsv(h, s, l);

  function onSVChange(newSatHSV: number, newValHSV: number) {
    const [, ns, nl] = hsvToHsl(hsvH, newSatHSV, newValHSV);
    setS(ns);
    setL(nl);
  }

  const isCentered = variant === "centered";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[110] bg-black/60 flex",
        isCentered ? "items-center justify-center p-4" : "items-end"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "bg-white relative",
          isCentered
            ? "w-full max-w-[440px] rounded-card px-5 pt-3 pb-4 shadow-2xl"
            : "w-full max-w-[480px] mx-auto rounded-t-[24px] px-5 pt-3"
        )}
        style={
          isCentered
            ? undefined
            : { paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {isCentered ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close color picker"
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-dw-fg hover:bg-dw-fg/10 cursor-pointer"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        ) : (
          <div className="flex justify-center pt-1 pb-2">
            <div className="w-[39px] h-[4px] bg-dw-fg/30 rounded-pill" />
          </div>
        )}
        <p className="text-center font-semibold text-[15px] text-dw-fg mb-3">
          Pick a color
        </p>

        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-14 h-14 rounded-card border border-dw-fg/15 shrink-0"
            style={{ backgroundColor: preview }}
          />
          <div className="flex-1">
            <p className="text-[11px] font-medium text-dw-gray mb-1">Hex</p>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={7}
              placeholder="#000000"
              className="w-full font-mono text-[15px] text-dw-fg bg-dw-card rounded-md px-3 py-2 outline-none border border-dw-fg/10 focus:border-dw-fg"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <ModeTab active={mode === "panel"} onClick={() => setMode("panel")} label="Panel" />
          <ModeTab active={mode === "sliders"} onClick={() => setMode("sliders")} label="Sliders" />
        </div>

        {mode === "panel" ? (
          <>
            <SVPanel hue={h} satHSV={hsvS} valHSV={hsvV} onChange={onSVChange} />
            <div className="mt-3">
              <Slider
                label="Hue"
                min={0}
                max={360}
                value={h}
                onChange={setH}
                trackStyle={{
                  background:
                    "linear-gradient(to right, hsl(0,100%,50%), hsl(45,100%,50%), hsl(90,100%,50%), hsl(135,100%,50%), hsl(180,100%,50%), hsl(225,100%,50%), hsl(270,100%,50%), hsl(315,100%,50%), hsl(360,100%,50%))",
                }}
              />
            </div>
          </>
        ) : (
          <>
            <Slider
              label="Hue"
              min={0}
              max={360}
              value={h}
              onChange={setH}
              trackStyle={{
                background:
                  "linear-gradient(to right, hsl(0,100%,50%), hsl(45,100%,50%), hsl(90,100%,50%), hsl(135,100%,50%), hsl(180,100%,50%), hsl(225,100%,50%), hsl(270,100%,50%), hsl(315,100%,50%), hsl(360,100%,50%))",
              }}
            />
            <Slider
              label="Saturation"
              min={0}
              max={100}
              value={s}
              onChange={setS}
              trackStyle={{
                background: `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`,
              }}
            />
            <Slider
              label="Brightness"
              min={5}
              max={95}
              value={l}
              onChange={setL}
              trackStyle={{
                background: `linear-gradient(to right, hsl(${h} ${s}% 5%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 95%))`,
              }}
            />
          </>
        )}

        <div className="mt-4 flex gap-3">
          <OutlineButton onClick={onClose} className="flex-1">
            Cancel
          </OutlineButton>
          <PrimaryButton
            onClick={() => onPick(previewHex)}
            className="flex-1"
          >
            Use this color
          </PrimaryButton>
        </div>
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
        "flex-1 h-9 rounded-pill text-[13px] font-semibold cursor-pointer transition",
        active ? "bg-dw-fg text-white" : "bg-dw-card text-dw-fg border border-dw-fg/15"
      )}
    >
      {label}
    </button>
  );
}

function SVPanel({
  hue,
  satHSV,
  valHSV,
  onChange,
}: {
  hue: number;
  satHSV: number;
  valHSV: number;
  onChange: (newSat: number, newVal: number) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function update(clientX: number, clientY: number) {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange(x * 100, (1 - y) * 100);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    update(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    e.preventDefault();
    update(e.clientX, e.clientY);
  }
  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  return (
    <div
      ref={panelRef}
      role="application"
      aria-label="Saturation and brightness picker"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className="relative w-full rounded-card overflow-hidden touch-none select-none cursor-crosshair border border-dw-fg/10"
      style={{
        aspectRatio: "16 / 11",
        backgroundColor: `hsl(${hue}, 100%, 50%)`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, #ffffff, rgba(255,255,255,0))",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to top, #000000, rgba(0,0,0,0))",
        }}
      />
      <div
        className="absolute w-6 h-6 rounded-full border-[3px] border-white shadow-md pointer-events-none"
        style={{
          left: `calc(${satHSV}% - 12px)`,
          top: `calc(${100 - valHSV}% - 12px)`,
        }}
      />
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
  trackStyle,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  trackStyle?: React.CSSProperties;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function updateFromClientX(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(min + pct * (max - min));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    e.preventDefault();
    updateFromClientX(e.clientX);
  }
  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-3 select-none">
      <div className="flex justify-between mb-1.5">
        <span className="text-[13px] font-semibold text-dw-fg">{label}</span>
        <span className="text-[13px] font-semibold text-dw-fg tabular-nums">
          {Math.round(value)}
        </span>
      </div>
      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="relative h-12 touch-none cursor-pointer"
      >
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-5 rounded-pill border border-dw-fg/10"
          style={trackStyle}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-[3px] border-dw-fg shadow-md pointer-events-none"
          style={{ left: `calc(${pct}% - 16px)` }}
        />
      </div>
    </div>
  );
}

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hh = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hh = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hh = (b - r) / d + 2;
        break;
      case b:
        hh = (r - g) / d + 4;
        break;
    }
    hh /= 6;
  }
  return [Math.round(hh * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lNorm - c / 2;
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hslToHsv(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const v = lN + sN * Math.min(lN, 1 - lN);
  const sV = v === 0 ? 0 : 2 * (1 - lN / v);
  return [h, Math.round(sV * 100), Math.round(v * 100)];
}

function hsvToHsl(h: number, s: number, v: number): [number, number, number] {
  const sN = s / 100;
  const vN = v / 100;
  const l = vN * (1 - sN / 2);
  const sL = l === 0 || l === 1 ? 0 : (vN - l) / Math.min(l, 1 - l);
  return [h, Math.round(sL * 100), Math.round(l * 100)];
}
