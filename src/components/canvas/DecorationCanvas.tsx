"use client";

import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { StickerLayer } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface PlacedSticker extends StickerLayer {
  instanceId: string;
}

interface Props {
  cakeImageUrl: string;
  stickers: { id: string; image_url: string; category: string }[];
  onCommit: (pngBlob: Blob, layers: StickerLayer[]) => void;
  isCommitting: boolean;
  /** "fit" = plain cake (occupies ~95% of canvas, centered). "fill" = a
   *  previous-frame snapshot that already covers the full canvas. */
  baseImageMode?: "fit" | "fill";
  /** "aspect" (default) preserves the 400:450 canvas ratio; "fill" stretches
   *  the canvas to the full container dimensions. */
  fitMode?: "aspect" | "fill";
  onPlacedDragStart?: () => void;
  onPlacedDragMove?: (clientX: number, clientY: number) => void;
  /** Return true if the drag should result in deletion (over trash). */
  shouldDeleteOnDragEnd?: (clientX: number, clientY: number) => boolean;
  onPlacedDragEnd?: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function stickerCenter(s: PlacedSticker): { x: number; y: number } {
  // Konva rotates around (x, y); the image extends w*scaleX × h*scaleY from
  // there in the unrotated frame. Center in unrotated local = (W/2, H/2).
  const W = s.width * s.scaleX;
  const H = s.height * s.scaleY;
  const rad = (s.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const sn = Math.sin(rad);
  return {
    x: s.x + c * (W / 2) - sn * (H / 2),
    y: s.y + sn * (W / 2) + c * (H / 2),
  };
}

function StickerNode({
  sticker,
  isSelected,
  onSelect,
  onChange,
  onDragStart,
  onDragMove,
  onDragEndWithPointer,
}: {
  sticker: PlacedSticker;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (s: PlacedSticker) => void;
  onDragStart?: () => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEndWithPointer?: (clientX: number, clientY: number) => boolean;
}) {
  const [image] = useImage(sticker.imageUrl, "anonymous");
  const imgRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // 2-finger pinch + rotate state
  const gestureRef = useRef<{
    startDist: number;
    startAngleRad: number;
    startSticker: PlacedSticker;
    startCenter: { x: number; y: number };
  } | null>(null);
  const [gestureActive, setGestureActive] = useState(false);

  useEffect(() => {
    if (isSelected && trRef.current && imgRef.current) {
      trRef.current.nodes([imgRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  function onTouchStartNode(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      // Two fingers landed on this sticker — claim the gesture.
      e.cancelBubble = true; // don't let the stage start a pinch-to-zoom
      e.evt.preventDefault();
      imgRef.current?.stopDrag();
      onSelect();
      const t1 = touches[0];
      const t2 = touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      gestureRef.current = {
        startDist: Math.hypot(dx, dy),
        startAngleRad: Math.atan2(dy, dx),
        startSticker: { ...sticker },
        startCenter: stickerCenter(sticker),
      };
      setGestureActive(true);
    }
  }

  function onTouchMoveNode(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length === 2 && gestureRef.current) {
      e.cancelBubble = true;
      e.evt.preventDefault();
      const g = gestureRef.current;
      const t1 = touches[0];
      const t2 = touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const angleRad = Math.atan2(dy, dx);
      const scaleRatio = dist / g.startDist;
      const angleDeltaDeg = ((angleRad - g.startAngleRad) * 180) / Math.PI;

      const start = g.startSticker;
      const newScale = clamp(start.scaleX * scaleRatio, 0.15, 10);
      const updated: PlacedSticker = {
        ...start,
        scaleX: newScale,
        scaleY: newScale,
        rotation: start.rotation + angleDeltaDeg,
      };
      // Anchor the sticker's center to where it was at gesture start.
      const newCenter = stickerCenter(updated);
      updated.x += g.startCenter.x - newCenter.x;
      updated.y += g.startCenter.y - newCenter.y;
      onChange(updated);
    }
  }

  function onTouchEndNode(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2 && gestureRef.current) {
      gestureRef.current = null;
      setGestureActive(false);
    }
  }

  return (
    <>
      <KonvaImage
        ref={imgRef}
        image={image}
        x={sticker.x}
        y={sticker.y}
        width={sticker.width}
        height={sticker.height}
        rotation={sticker.rotation}
        scaleX={sticker.scaleX}
        scaleY={sticker.scaleY}
        draggable={!gestureActive}
        onClick={onSelect}
        onTap={onSelect}
        onTouchStart={onTouchStartNode}
        onTouchMove={onTouchMoveNode}
        onTouchEnd={onTouchEndNode}
        onDragStart={() => {
          onSelect();
          onDragStart?.();
        }}
        onDragMove={(e) => {
          const evt = e.evt as MouseEvent | TouchEvent | null | undefined;
          let cx = 0;
          let cy = 0;
          if (evt) {
            if ("touches" in evt && evt.touches && evt.touches.length > 0) {
              cx = evt.touches[0].clientX;
              cy = evt.touches[0].clientY;
            } else if ("clientX" in evt) {
              cx = (evt as MouseEvent).clientX;
              cy = (evt as MouseEvent).clientY;
            }
          }
          onDragMove?.(cx, cy);
        }}
        onDragEnd={(e) => {
          const evt = e.evt as MouseEvent | TouchEvent | null | undefined;
          let cx = 0;
          let cy = 0;
          if (evt) {
            if (
              "changedTouches" in evt &&
              evt.changedTouches &&
              evt.changedTouches.length > 0
            ) {
              cx = evt.changedTouches[0].clientX;
              cy = evt.changedTouches[0].clientY;
            } else if ("clientX" in evt) {
              cx = (evt as MouseEvent).clientX;
              cy = (evt as MouseEvent).clientY;
            }
          }
          const shouldDelete = evt
            ? onDragEndWithPointer?.(cx, cy) ?? false
            : false;
          if (!shouldDelete) {
            onChange({ ...sticker, x: e.target.x(), y: e.target.y() });
          }
        }}
        onTransformEnd={() => {
          const node = imgRef.current!;
          onChange({
            ...sticker,
            x: node.x(),
            y: node.y(),
            scaleX: node.scaleX(),
            scaleY: node.scaleY(),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && !gestureActive && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}

export interface DecorationCanvasHandle {
  commit: () => void;
  addSticker: (imageUrl: string) => void;
}

const DecorationCanvas = forwardRef<DecorationCanvasHandle, Props>(function DecorationCanvas({
  cakeImageUrl,
  stickers: _stickers,
  onCommit,
  isCommitting: _isCommitting,
  baseImageMode = "fit",
  fitMode = "aspect",
  onPlacedDragStart,
  onPlacedDragMove,
  shouldDeleteOnDragEnd,
  onPlacedDragEnd,
}: Props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 400, h: 450 });
  const [placedStickers, setPlacedStickers] = useState<PlacedSticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cakeImage] = useImage(cakeImageUrl, "anonymous");

  // View transform (zoom + pan)
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
    startCenter: { x: number; y: number };
    startView: { x: number; y: number };
  } | null>(null);
  const panRef = useRef<{
    startTouchX: number;
    startTouchY: number;
    startViewX: number;
    startViewY: number;
  } | null>(null);

  // Measure container in both dimensions and pick a canvas size that fits
  // while preserving the 353:500 aspect ratio.
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return;
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      if (fitMode === "fill" && ch > 0) {
        setCanvasSize({ w: Math.round(cw), h: Math.round(ch) });
        return;
      }
      const ratio = 450 / 400;
      let w = cw;
      let h = w * ratio;
      if (ch > 0 && h > ch) {
        h = ch;
        w = h / ratio;
      }
      setCanvasSize({ w: Math.round(w), h: Math.round(h) });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fitMode]);

  // Keep pan within bounds so the canvas can't be dragged off-screen.
  const clampView = useCallback(
    (v: { scale: number; x: number; y: number }) => {
      const maxOffset = (s: number) => (s - 1) * 0; // anchored top-left at zoom 1
      // When zoomed in, allow pan such that we never expose more than the
      // canvas: x in [canvasSize.w*(1-scale), 0], y similar.
      const minX = canvasSize.w * (1 - v.scale);
      const minY = canvasSize.h * (1 - v.scale);
      return {
        scale: v.scale,
        x: clamp(v.x, minX, 0 + maxOffset(v.scale)),
        y: clamp(v.y, minY, 0 + maxOffset(v.scale)),
      };
    },
    [canvasSize.w, canvasSize.h]
  );

  const addSticker = useCallback(
    (imageUrl: string) => {
      // Default sticker size scales with the canvas so a placed sticker
      // stays visible on large desktop canvases. Mobile keeps the original
      // 80px size (canvas there is ~400px, 80 ≈ 20% of min-dim).
      const minDim = Math.min(canvasSize.w, canvasSize.h);
      // Desktop ("fill" fitMode) has much more room; start placed
      // stickers bigger so users don't have to resize-and-blur them.
      const sizeRatio = fitMode === "fill" ? 0.32 : 0.2;
      const minSize = fitMode === "fill" ? 160 : 80;
      const targetSize = Math.max(minSize, Math.round(minDim * sizeRatio));
      const visibleCenterX = (canvasSize.w / 2 - view.x) / view.scale;
      const visibleCenterY = (canvasSize.h / 2 - view.y) / view.scale;

      // Preload the image to read its natural dimensions, so we can
      // place it without squashing the aspect ratio and without
      // upscaling small images into a blur.
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const nw = img.naturalWidth || img.width;
        const nh = img.naturalHeight || img.height;
        let w: number;
        let h: number;
        if (nw === 0 || nh === 0) {
          w = targetSize;
          h = targetSize;
        } else {
          const aspect = nw / nh;
          // Fit the longer side into `targetSize` (the natural-size aware
          // budget): never upscale beyond the image's own pixels.
          const longSide = Math.min(targetSize, Math.max(nw, nh));
          if (aspect >= 1) {
            w = longSide;
            h = Math.round(longSide / aspect);
          } else {
            h = longSide;
            w = Math.round(longSide * aspect);
          }
        }
        const newSticker: PlacedSticker = {
          instanceId: uuidv4(),
          stickerId: imageUrl,
          imageUrl,
          x: visibleCenterX - w / 2,
          y: visibleCenterY - h / 2,
          width: w,
          height: h,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        setPlacedStickers((prev) => [...prev, newSticker]);
        setSelectedId(newSticker.instanceId);
      };
      img.onerror = () => {
        // Fall back to square placement if the image can't be loaded.
        const newSticker: PlacedSticker = {
          instanceId: uuidv4(),
          stickerId: imageUrl,
          imageUrl,
          x: visibleCenterX - targetSize / 2,
          y: visibleCenterY - targetSize / 2,
          width: targetSize,
          height: targetSize,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
        setPlacedStickers((prev) => [...prev, newSticker]);
        setSelectedId(newSticker.instanceId);
      };
      img.src = imageUrl;
    },
    [canvasSize.w, canvasSize.h, view.scale, view.x, view.y, fitMode]
  );

  function handleTouchStart(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const rect = containerRef.current?.getBoundingClientRect();
      const cx = (t1.clientX + t2.clientX) / 2 - (rect?.left ?? 0);
      const cy = (t1.clientY + t2.clientY) / 2 - (rect?.top ?? 0);
      pinchRef.current = {
        startDist: dist,
        startScale: view.scale,
        startCenter: { x: cx, y: cy },
        startView: { x: view.x, y: view.y },
      };
      panRef.current = null;
      return;
    }
    if (touches.length === 1 && e.target === e.target.getStage()) {
      // Deselect on background tap
      setSelectedId(null);
      if (view.scale > 1) {
        panRef.current = {
          startTouchX: touches[0].clientX,
          startTouchY: touches[0].clientY,
          startViewX: view.x,
          startViewY: view.y,
        };
      }
    }
  }

  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const touches = e.evt.touches;
    if (touches.length === 2 && pinchRef.current) {
      e.evt.preventDefault();
      const t1 = touches[0];
      const t2 = touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scaleRatio = dist / pinchRef.current.startDist;
      const newScale = clamp(pinchRef.current.startScale * scaleRatio, MIN_ZOOM, MAX_ZOOM);
      // Keep the pinch center stable in canvas space:
      // newView = center - (center - startView) * (newScale / startScale)
      const k = newScale / pinchRef.current.startScale;
      const newX =
        pinchRef.current.startCenter.x -
        (pinchRef.current.startCenter.x - pinchRef.current.startView.x) * k;
      const newY =
        pinchRef.current.startCenter.y -
        (pinchRef.current.startCenter.y - pinchRef.current.startView.y) * k;
      setView(clampView({ scale: newScale, x: newX, y: newY }));
      return;
    }
    if (touches.length === 1 && panRef.current) {
      e.evt.preventDefault();
      const pan = panRef.current;
      const t = touches[0];
      const dx = t.clientX - pan.startTouchX;
      const dy = t.clientY - pan.startTouchY;
      setView((v) =>
        clampView({
          scale: v.scale,
          x: pan.startViewX + dx,
          y: pan.startViewY + dy,
        })
      );
    }
  }

  function handleTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length < 2) pinchRef.current = null;
    if (e.evt.touches.length === 0) panRef.current = null;
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const oldScale = view.scale;
    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = clamp(
      direction > 0 ? oldScale * scaleBy : oldScale / scaleBy,
      MIN_ZOOM,
      MAX_ZOOM
    );
    const mx = (pointer.x - view.x) / oldScale;
    const my = (pointer.y - view.y) / oldScale;
    setView(
      clampView({
        scale: newScale,
        x: pointer.x - mx * newScale,
        y: pointer.y - my * newScale,
      })
    );
  }

  function deselectOnClickBg(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }
  }

  function resetView() {
    setView({ scale: 1, x: 0, y: 0 });
  }

  useImperativeHandle(ref, () => ({
    commit: () => handleCommit(),
    addSticker,
  }));

  const handleCommit = useCallback(async () => {
    if (!stageRef.current) return;
    setSelectedId(null);
    const stage = stageRef.current;
    // Snapshot in canvas-space, not view-space, so the saved frame is
    // independent of the user's current zoom/pan.
    const prevScale = stage.scale();
    const prevPos = stage.position();
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    await new Promise((r) => setTimeout(r, 60));
    stage.toBlob({
      mimeType: "image/png",
      quality: 1,
      pixelRatio: Math.round(1080 / canvasSize.w),
      callback: (blob) => {
        // Restore the user's view
        stage.scale(prevScale);
        stage.position(prevPos);
        stage.batchDraw();
        if (!blob) return;
        const layers: StickerLayer[] = placedStickers.map(
          ({ instanceId: _, ...rest }) => rest
        );
        onCommit(blob, layers);
      },
    });
  }, [placedStickers, canvasSize.w, onCommit]);

  // Base image fit. "fit" = ~65% of canvas (default cake). "fill" = covers
  // the entire canvas (previous-frame snapshot, already canvas-sized).
  const cakeFit = (() => {
    if (!cakeImage) return null;
    if (baseImageMode === "fill") {
      return { x: 0, y: 0, width: canvasSize.w, height: canvasSize.h };
    }
    const fitFactor = fitMode === "fill" ? 0.65 : 0.85;
    const scale = Math.min(
      (canvasSize.w * fitFactor) / cakeImage.width,
      (canvasSize.h * fitFactor) / cakeImage.height
    );
    const dw = cakeImage.width * scale;
    const dh = cakeImage.height * scale;
    // The cake PNG has a bit of whitespace above the illustration, so
    // strict geometric centering ends up looking high on mobile. Nudge
    // down by ~5% of the canvas height (mobile only) so the cake visually
    // lands at center.
    const yBias = fitMode === "fill" ? 0 : canvasSize.h * 0.05;
    return {
      x: (canvasSize.w - dw) / 2,
      y: Math.min(
        (canvasSize.h - dh) / 2 + yBias,
        canvasSize.h - dh
      ),
      width: dw,
      height: dh,
    };
  })();

  const isZoomed = view.scale > 1.01;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center touch-none relative"
    >
      <div
        className="rounded-card overflow-hidden border border-dw-fg relative"
        style={{
          width: canvasSize.w,
          height: canvasSize.h,
          backgroundColor: "#FAF8F6",
        }}
      >
        <Stage
          ref={stageRef}
          width={canvasSize.w}
          height={canvasSize.h}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          onMouseDown={deselectOnClickBg}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          <Layer>
            <Rect
              x={0}
              y={0}
              width={canvasSize.w}
              height={canvasSize.h}
              fill="#FAF8F6"
              listening={false}
            />
            {cakeImage && cakeFit && (
              <KonvaImage
                image={cakeImage}
                x={cakeFit.x}
                y={cakeFit.y}
                width={cakeFit.width}
                height={cakeFit.height}
                listening={false}
              />
            )}
            {placedStickers.map((s) => (
              <StickerNode
                key={s.instanceId}
                sticker={s}
                isSelected={selectedId === s.instanceId}
                onSelect={() => setSelectedId(s.instanceId)}
                onChange={(updated) =>
                  setPlacedStickers((prev) =>
                    prev.map((p) =>
                      p.instanceId === updated.instanceId ? updated : p
                    )
                  )
                }
                onDragStart={onPlacedDragStart}
                onDragMove={onPlacedDragMove}
                onDragEndWithPointer={(cx, cy) => {
                  onPlacedDragEnd?.();
                  if (shouldDeleteOnDragEnd?.(cx, cy)) {
                    setPlacedStickers((prev) =>
                      prev.filter((p) => p.instanceId !== s.instanceId)
                    );
                    if (selectedId === s.instanceId) setSelectedId(null);
                    return true;
                  }
                  return false;
                }}
              />
            ))}
          </Layer>
        </Stage>

        {/* Zoom indicator + reset (only visible when zoomed) */}
        {isZoomed && (
          <button
            type="button"
            onClick={resetView}
            className="absolute top-2 right-2 h-7 px-3 rounded-pill bg-dw-fg/85 text-white text-[12px] font-semibold cursor-pointer select-none"
          >
            {view.scale.toFixed(1)}× · Reset
          </button>
        )}
      </div>
    </div>
  );
});

export default DecorationCanvas;
