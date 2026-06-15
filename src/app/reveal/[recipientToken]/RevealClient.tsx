"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { Gift } from "@/types";
import { getReveal } from "@/lib/localStore";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface Props {
  recipientToken: string;
}

const FRAME_MS = 600;
// Width of the rendered frame inside the exported media. Height is derived
// from the actual frame aspect so there are no white side gaps.
const FRAME_WIDTH = 720;
const HEADER_HEIGHT = 200;
const MP4_FPS = 30;
const VIDEO_LOOPS = 2;
const CAKE_BASE_IMAGE = "/cake-no-candle.png";
const STAR_IMAGE = "/star.png";

export default function RevealClient({ recipientToken }: Props) {
  const router = useRouter();
  const [gift, setGift] = useState<Gift | null>(null);
  const [frameUrls, setFrameUrls] = useState<string[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  // Aspect ratio of the actual frame, sniffed from the first image.
  const [frameAspect, setFrameAspect] = useState<number>(353 / 500);
  // Dimensions of the first frame snapshot, used to render a pixel-perfect
  // empty-cake intro at the exact same canvas size.
  const [frameDims, setFrameDims] = useState<{ w: number; h: number } | null>(
    null
  );
  const [introCakeUrl, setIntroCakeUrl] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<
    null | { kind: "gif" | "video" | "ig"; progress: number; label: string }
  >(null);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getReveal(recipientToken);
      if (cancelled) return;
      if (!data || (data.gift.status !== "sent" && data.gift.status !== "opened")) {
        setNotFound(true);
        return;
      }
      setGift(data.gift);
      setFrameUrls(data.frameUrls);
      // Sniff the first frame's aspect ratio so the player + exports use it.
      if (data.frameUrls[0]) {
        const probe = new Image();
        probe.onload = () => {
          if (cancelled) return;
          if (probe.width > 0 && probe.height > 0) {
            setFrameAspect(probe.width / probe.height);
            setFrameDims({ w: probe.width, h: probe.height });
          }
        };
        probe.src = data.frameUrls[0];
      }
    })();
    return () => { cancelled = true; };
  }, [recipientToken]);

  // Build the empty-cake intro at the EXACT same dimensions + cake position
  // as the decorated frame snapshots, so swapping between them looks
  // pixel-stable. Re-renders whenever the chosen template or sniffed frame
  // dimensions change.
  useEffect(() => {
    if (!gift || !frameDims) return;
    let cancelled = false;
    (async () => {
      const cakeUrl = gift.cake_template ?? CAKE_BASE_IMAGE;
      const img = await loadImage(cakeUrl).catch(() => null);
      if (cancelled || !img) return;
      const canvas = document.createElement("canvas");
      canvas.width = frameDims.w;
      canvas.height = frameDims.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FAF8F6";
      ctx.fillRect(0, 0, frameDims.w, frameDims.h);
      // Match `fitFactor` in DecorationCanvas: 0.85 on mobile (portrait
      // canvas), 0.65 on desktop (squarer "fill" canvas).
      const isMobile = frameDims.w / frameDims.h < 0.92;
      const fitFactor = isMobile ? 0.85 : 0.65;
      const scale = Math.min(
        (frameDims.w * fitFactor) / img.width,
        (frameDims.h * fitFactor) / img.height
      );
      const dw = img.width * scale;
      const dh = img.height * scale;
      // Match the y-bias used in DecorationCanvas so the intro cake lands
      // in the same spot as the cake baked into the decorated frames.
      const yBias = isMobile ? frameDims.h * 0.05 : 0;
      ctx.drawImage(
        img,
        (frameDims.w - dw) / 2,
        Math.min((frameDims.h - dh) / 2 + yBias, frameDims.h - dh),
        dw,
        dh
      );
      if (!cancelled) setIntroCakeUrl(canvas.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
  }, [gift, frameDims]);

  useEffect(() => {
    if (frameUrls.length === 0) return;
    // Cycle: [empty cake intro, frame 1, frame 2, …, frame N] then loops.
    // Step 0 = intro, step 1..N = frameUrls[0..N-1].
    const total = frameUrls.length + 1;
    function tick() {
      setCurrentFrame((i) => (i + 1) % total);
      timerRef.current = window.setTimeout(tick, FRAME_MS);
    }
    timerRef.current = window.setTimeout(tick, FRAME_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [frameUrls]);

  async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // Standard layout used for GIF + plain MP4
  function regularLayout(): MediaLayout {
    // Smaller heading logo for all exports.
    const headerScale = 0.7;
    const headerH = Math.round(HEADER_HEIGHT * headerScale);
    const frameH = Math.round(FRAME_WIDTH / frameAspect);
    return {
      canvasW: FRAME_WIDTH,
      canvasH: headerH + frameH,
      headerY: 0,
      headerScale,
      frameX: 0,
      frameY: headerH,
      frameW: FRAME_WIDTH,
      frameH,
    };
  }

  // Instagram Stories layout — 9:16 portrait, 1080×1920. Heading sticks
  // to the top (above any IG UI overlays); the cake frame is centered in
  // whatever space is left below the heading.
  function igStoryLayout(): MediaLayout {
    const canvasW = 1080;
    const canvasH = 1920;
    const headerScale = 1.05;
    const headerH = Math.round(HEADER_HEIGHT * headerScale);
    const topPad = 60;
    const headerBottom = topPad + headerH;
    const remainingH = canvasH - headerBottom;
    // Fit the frame into the remaining height while preserving aspect;
    // if it would overflow, scale it down so it still fits.
    const baseFrameW = canvasW;
    const baseFrameH = Math.round(baseFrameW / frameAspect);
    const fitScale = Math.min(1, remainingH / baseFrameH);
    const frameW = Math.round(baseFrameW * fitScale);
    const frameH = Math.round(baseFrameH * fitScale);
    const frameX = Math.round((canvasW - frameW) / 2);
    const frameY = headerBottom + Math.round((remainingH - frameH) / 2);
    return {
      canvasW,
      canvasH,
      headerY: topPad,
      headerScale,
      frameX,
      frameY,
      frameW,
      frameH,
    };
  }

  interface MediaLayout {
    canvasW: number;
    canvasH: number;
    headerY: number;
    headerScale: number;
    frameY: number;
    frameX: number;
    frameW: number;
    frameH: number;
  }

  function paintFrame(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    layout: MediaLayout,
    star: HTMLImageElement | null
  ) {
    ctx.fillStyle = "#FAF8F6";
    ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);
    paintHeader(ctx, layout, star);
    ctx.drawImage(img, layout.frameX, layout.frameY, layout.frameW, layout.frameH);
  }

  /**
   * Paint the "initial" empty-cake frame: same header, but the body is a
   * blank background with the cake illustration centered (no stickers yet).
   * Used as the first frame in the exported sequence so the story reads
   * cake → friend 1 → friend 2 → …
   */
  function paintInitialFrame(
    ctx: CanvasRenderingContext2D,
    cake: HTMLImageElement,
    layout: MediaLayout,
    star: HTMLImageElement | null
  ) {
    ctx.fillStyle = "#FAF8F6";
    ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);
    paintHeader(ctx, layout, star);

    // Match the cake scale used by the on-screen DecorationCanvas so the
    // intro frame is the same size as the cake inside the first decorated
    // frame. Mobile canvas (aspect < 0.92) uses 0.85; desktop fill canvas
    // (squarer aspect) uses 0.65. These must stay in sync with the
    // `fitFactor` constants in DecorationCanvas.tsx.
    const isMobile = frameAspect < 0.92;
    const fitFactor = isMobile ? 0.85 : 0.65;
    const scale = Math.min(
      (layout.frameW * fitFactor) / cake.width,
      (layout.frameH * fitFactor) / cake.height
    );
    const cw = cake.width * scale;
    const ch = cake.height * scale;
    const cx = layout.frameX + (layout.frameW - cw) / 2;
    // Apply the same 5% downward nudge as DecorationCanvas on mobile so
    // the empty-cake export frame lines up with the cake baked into the
    // decorated frames.
    const yBias = isMobile ? layout.frameH * 0.05 : 0;
    const cy =
      layout.frameY +
      Math.min((layout.frameH - ch) / 2 + yBias, layout.frameH - ch);
    ctx.drawImage(cake, cx, cy, cw, ch);
  }

  /**
   * Paint the DoodleWish header to match the in-app compact header:
   *   "Wishes you can scribble together."   (tagline)
   *   "Doodle"
   *   "Wish."        ★   (star.png to the right)
   *
   * Anchored at layout.headerY, scaled by layout.headerScale.
   */
  function paintHeader(
    ctx: CanvasRenderingContext2D,
    layout: MediaLayout,
    star: HTMLImageElement | null
  ) {
    const s = layout.headerScale;
    const width = layout.canvasW;
    ctx.save();
    ctx.translate(0, layout.headerY);
    ctx.fillStyle = "#232220";
    ctx.textBaseline = "alphabetic";

    // Tagline
    ctx.font = `500 ${Math.round(22 * s)}px Figtree, -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Wishes you can scribble together.", width / 2, 42 * s);

    // Wordmark — two lines, left-aligned within a centered group.
    ctx.font = `900 ${Math.round(60 * s)}px Figtree, -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "left";
    const line1 = "Doodle";
    const line2 = "Wish.";
    const wordW = Math.max(
      ctx.measureText(line1).width,
      ctx.measureText(line2).width
    );

    // Star asset size — keep it square, ~130px tall in the regular layout.
    const starSize = 130 * s;
    const gap = 18 * s;
    const groupW = wordW + gap + starSize;
    const groupX = (width - groupW) / 2;
    const line1Y = 110 * s;
    const line2Y = 168 * s;
    ctx.fillText(line1, groupX, line1Y);
    ctx.fillText(line2, groupX, line2Y);

    // Star PNG, vertically centered next to the wordmark.
    if (star) {
      // Preserve aspect ratio within a starSize-tall slot.
      const ratio = star.width / star.height;
      const drawH = starSize;
      const drawW = drawH * ratio;
      const starX = groupX + wordW + gap + (starSize - drawW) / 2;
      // Vertically center on the wordmark midline (~midpoint of the two lines).
      const wordmarkMidY = (line1Y - 60 * s + line2Y) / 2; // approx visual middle
      const starY = wordmarkMidY - drawH / 2;
      ctx.drawImage(star, starX, starY, drawW, drawH);
    }

    ctx.restore();
  }

  async function preloadFrames(): Promise<HTMLImageElement[]> {
    return Promise.all(frameUrls.map(loadImage));
  }

  /* ----------------- GIF export ----------------- */

  async function saveGif() {
    if (!gift || frameUrls.length === 0 || exportStatus) return;
    setExportStatus({ kind: "gif", progress: 0, label: "Building GIF…" });
    const startedAt = Date.now();
    track("export_started", { format: "gif" });
    try {
      const GIF = (await import("gif.js")).default;
      const layout = regularLayout();
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: layout.canvasW,
        height: layout.canvasH,
        workerScript: "/gif.worker.js",
        background: "#FAF8F6",
      });

      const canvas = document.createElement("canvas");
      canvas.width = layout.canvasW;
      canvas.height = layout.canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      const imgs = await preloadFrames();
      // Pull the empty-cake intro from the gift's stored template (set by
      // the first contributor), so the intro matches what they actually
      // picked. Falls back to the default cake if it's missing.
      const cakeUrl = gift.cake_template ?? CAKE_BASE_IMAGE;
      const [cake, star] = await Promise.all([
        loadImage(cakeUrl).catch(() => loadImage(CAKE_BASE_IMAGE)),
        loadImage(STAR_IMAGE).catch(() => null),
      ]);
      // First GIF frame = empty cake (matching the chosen template), then
      // the actual decorated frames in order.
      paintInitialFrame(ctx, cake, layout, star);
      gif.addFrame(ctx, { copy: true, delay: FRAME_MS });
      for (const img of imgs) {
        paintFrame(ctx, img, layout, star);
        gif.addFrame(ctx, { copy: true, delay: FRAME_MS });
      }

      gif.on("progress", (p) =>
        setExportStatus({
          kind: "gif",
          progress: Math.round(p * 100),
          label: "Building GIF…",
        })
      );
      gif.on("finished", async (blob: Blob) => {
        await saveOrShare(
          blob,
          `doodlewish-${gift.recipient_name ?? "gift"}.gif`
        );
        track("export_saved", {
          format: "gif",
          duration_ms: Date.now() - startedAt,
        });
        setExportStatus(null);
      });
      gif.render();
    } catch (e) {
      console.error(e);
      track("export_failed", {
        format: "gif",
        reason: e instanceof Error ? e.message : "unknown",
      });
      alert("Couldn't create the GIF. Try again.");
      setExportStatus(null);
    }
  }

  /* ----------------- MP4 / WebM export ----------------- */

  function pickVideoMime(): { mime: string; ext: string } {
    // Chromium's MediaRecorder claims to support `video/mp4` but writes a
    // fragmented MP4 without a leading `moov` atom — Safari/QuickTime on
    // Mac/iPhone/iPad refuse to play it. Safari's own MediaRecorder, on
    // the other hand, produces a fully-formed MP4 with H.264 that plays
    // everywhere. So we only ask for MP4 when we know we're on a real
    // WebKit engine; on Chromium we ship WebM (which the browser plays
    // back fine and which converts cleanly with any external tool).
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isAppleWebKit =
      /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR/.test(ua);
    const appleCandidates = [
      { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
      { mime: "video/mp4;codecs=h264", ext: "mp4" },
      { mime: "video/mp4", ext: "mp4" },
    ];
    const webmCandidates = [
      { mime: "video/webm;codecs=vp9", ext: "webm" },
      { mime: "video/webm;codecs=vp8", ext: "webm" },
      { mime: "video/webm", ext: "webm" },
    ];
    const candidates = isAppleWebKit
      ? [...appleCandidates, ...webmCandidates]
      : [...webmCandidates, ...appleCandidates];
    for (const c of candidates) {
      try {
        if (
          typeof MediaRecorder !== "undefined" &&
          MediaRecorder.isTypeSupported(c.mime)
        ) {
          return c;
        }
      } catch {}
    }
    return { mime: "", ext: "webm" };
  }

  /**
   * Preferred MP4 path: WebCodecs `VideoEncoder` + `mp4-muxer`. Produces a
   * standards-compliant MP4 (H.264 baseline, faststart) that plays back in
   * Photos / QuickTime / iOS Safari — including when you share/save to the
   * camera roll. Returns null if the browser doesn't support WebCodecs;
   * the caller then falls back to MediaRecorder.
   */
  async function encodeMp4WithWebCodecs(
    layout: MediaLayout,
    kind: "video" | "ig",
    label: string
  ): Promise<{ blob: Blob; ext: string; mime: string } | null> {
    if (!gift) return null;
    if (
      typeof window === "undefined" ||
      typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder ===
        "undefined" ||
      typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame ===
        "undefined"
    ) {
      return null;
    }
    // H.264 needs even dimensions.
    const W = layout.canvasW - (layout.canvasW % 2);
    const H = layout.canvasH - (layout.canvasH % 2);

    setExportStatus({ kind, progress: 0, label });
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No canvas context");

    const adjustedLayout: MediaLayout = { ...layout, canvasW: W, canvasH: H };

    const imgs = await preloadFrames();
    const cakeUrl = gift.cake_template ?? CAKE_BASE_IMAGE;
    const [cake, star] = await Promise.all([
      loadImage(cakeUrl).catch(() => loadImage(CAKE_BASE_IMAGE)),
      loadImage(STAR_IMAGE).catch(() => null),
    ]);

    type Step = { kind: "cake" } | { kind: "frame"; img: HTMLImageElement };
    const uniqueSteps: Step[] = [
      { kind: "cake" },
      ...imgs.map((img) => ({ kind: "frame" as const, img })),
    ];
    const sequence: Step[] = [];
    for (let l = 0; l < VIDEO_LOOPS; l++) sequence.push(...uniqueSteps);

    let muxer: import("mp4-muxer").Muxer<import("mp4-muxer").ArrayBufferTarget>;
    let target: import("mp4-muxer").ArrayBufferTarget;
    try {
      const mod = await import("mp4-muxer");
      target = new mod.ArrayBufferTarget();
      muxer = new mod.Muxer({
        target,
        video: {
          codec: "avc",
          width: W,
          height: H,
          frameRate: MP4_FPS,
        },
        fastStart: "in-memory",
      });
    } catch (e) {
      console.error("[mp4-muxer] failed to load:", e);
      setExportStatus(null);
      return null;
    }

    type VideoChunkLike = { type: "key" | "delta"; timestamp: number };
    type ChunkMetaLike = { decoderConfig?: { description?: BufferSource } };
    const VideoEncoderCtor = (
      window as unknown as {
        VideoEncoder: new (init: {
          output: (chunk: VideoChunkLike, meta?: ChunkMetaLike) => void;
          error: (err: Error) => void;
        }) => {
          configure: (cfg: object) => void;
          encode: (frame: object, opts?: { keyFrame?: boolean }) => void;
          flush: () => Promise<void>;
          close: () => void;
        };
      }
    ).VideoEncoder;
    const VideoFrameCtor = (
      window as unknown as {
        VideoFrame: new (
          src: CanvasImageSource,
          init: { timestamp: number; duration?: number }
        ) => { close: () => void };
      }
    ).VideoFrame;

    const encoder = new VideoEncoderCtor({
      output: (chunk, meta) => {
        // mp4-muxer's addVideoChunk expects (chunk, meta) — types differ
        // slightly between the WebCodecs spec and the muxer typings, so
        // we cast at the boundary.
        (
          muxer as unknown as {
            addVideoChunk: (c: unknown, m?: unknown) => void;
          }
        ).addVideoChunk(chunk, meta);
      },
      error: (e) => {
        console.error("[VideoEncoder]", e);
      },
    });

    // Baseline 3.1 — the most broadly compatible H.264 profile on iOS/macOS.
    encoder.configure({
      codec: "avc1.42E01F",
      width: W,
      height: H,
      bitrate: 6_000_000,
      framerate: MP4_FPS,
      avc: { format: "avc" },
    });

    const FRAME_DURATION_US = Math.round(1_000_000 / MP4_FPS);
    const framesPerStep = Math.max(1, Math.round(FRAME_MS / (1000 / MP4_FPS)));
    let emittedFrames = 0;

    try {
      for (let s = 0; s < sequence.length; s++) {
        const step = sequence[s];
        if (step.kind === "cake")
          paintInitialFrame(ctx, cake, adjustedLayout, star);
        else paintFrame(ctx, step.img, adjustedLayout, star);
        for (let i = 0; i < framesPerStep; i++) {
          const ts = emittedFrames * FRAME_DURATION_US;
          const frame = new VideoFrameCtor(canvas, {
            timestamp: ts,
            duration: FRAME_DURATION_US,
          });
          // Force a keyframe at every step boundary so the file is still
          // seekable / iOS-safe even if the encoder picks a long GOP.
          encoder.encode(frame, { keyFrame: i === 0 });
          frame.close();
          emittedFrames++;
        }
        setExportStatus({
          kind,
          progress: Math.round(((s + 1) / sequence.length) * 100),
          label,
        });
        // Yield to the event loop so the UI stays responsive on long jobs.
        if (s % 3 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      await encoder.flush();
      encoder.close();
      (muxer as unknown as { finalize: () => void }).finalize();
      const buffer = (target as unknown as { buffer: ArrayBuffer }).buffer;
      return {
        blob: new Blob([buffer], { type: "video/mp4" }),
        ext: "mp4",
        mime: "video/mp4",
      };
    } catch (e) {
      console.error("[encodeMp4WithWebCodecs] failed:", e);
      try {
        encoder.close();
      } catch {}
      return null;
    }
  }

  async function encodeVideo(
    layout: MediaLayout,
    kind: "video" | "ig",
    label: string
  ): Promise<{ blob: Blob; ext: string; mime: string } | null> {
    // Try the WebCodecs MP4 pipeline first — produces a real MP4 that
    // plays in Photos / iOS share sheet save-to-camera-roll.
    try {
      const mp4 = await encodeMp4WithWebCodecs(layout, kind, label);
      if (mp4) return mp4;
    } catch (e) {
      console.error("WebCodecs path failed, falling back:", e);
    }
    if (!gift) return null;
    if (typeof MediaRecorder === "undefined") {
      alert("Video recording isn't supported in this browser.");
      return null;
    }
    setExportStatus({ kind, progress: 0, label });
    try {
      const canvas = document.createElement("canvas");
      canvas.width = layout.canvasW;
      canvas.height = layout.canvasH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      const imgs = await preloadFrames();
      const cakeUrl = gift.cake_template ?? CAKE_BASE_IMAGE;
      const [cake, star] = await Promise.all([
        loadImage(cakeUrl).catch(() => loadImage(CAKE_BASE_IMAGE)),
        loadImage(STAR_IMAGE).catch(() => null),
      ]);
      // Prime the canvas with the initial empty-cake frame so the stream
      // isn't blank and the export starts on the template the contributors
      // actually picked.
      paintInitialFrame(ctx, cake, layout, star);

      const { mime, ext } = pickVideoMime();
      const stream = canvas.captureStream(MP4_FPS);
      const track = stream.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined;
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      // Warm-up: give the encoder a few sample frames of the initial cake
      // before we start changing the canvas. Without this iOS Safari sometimes
      // drops the first step or reorders the timestamps of early frames.
      await wait(200);

      // Build the sequence explicitly so the order is unambiguous.
      // [cake, f1, f2, …, fN] played VIDEO_LOOPS times. The empty-cake
      // intro now uses the gift's stored template so it matches what the
      // contributors actually picked.
      type Step = { kind: "cake" } | { kind: "frame"; img: HTMLImageElement };
      const uniqueSteps: Step[] = [
        { kind: "cake" },
        ...imgs.map((img) => ({ kind: "frame" as const, img })),
      ];
      const sequence: Step[] = [];
      for (let l = 0; l < VIDEO_LOOPS; l++) {
        sequence.push(...uniqueSteps);
      }

      let drawn = 0;
      const totalSteps = sequence.length;

      // Repaint roughly once per stream frame inside each step so the
      // captureStream samples a fully-rendered canvas, never a mid-paint
      // state. This is what fixes the "messy / wrong order" output on iOS.
      const REPAINT_MS = Math.max(20, Math.round(1000 / MP4_FPS));
      const repaintsPerStep = Math.max(2, Math.round(FRAME_MS / REPAINT_MS));

      for (const step of sequence) {
        for (let r = 0; r < repaintsPerStep; r++) {
          if (step.kind === "cake") paintInitialFrame(ctx, cake, layout, star);
          else paintFrame(ctx, step.img, layout, star);
          // Force the stream to grab this exact frame timestamp.
          if (track && typeof track.requestFrame === "function") {
            track.requestFrame();
          }
          await wait(REPAINT_MS);
        }
        drawn++;
        setExportStatus({
          kind,
          progress: Math.round((drawn / totalSteps) * 100),
          label,
        });
      }

      // Brief hold on the last painted frame so the final image lands cleanly.
      const padRepaints = Math.max(1, Math.round(400 / REPAINT_MS));
      const lastStep = sequence[sequence.length - 1];
      for (let r = 0; r < padRepaints; r++) {
        if (lastStep.kind === "cake") paintInitialFrame(ctx, cake, layout, star);
        else paintFrame(ctx, lastStep.img, layout, star);
        if (track && typeof track.requestFrame === "function") {
          track.requestFrame();
        }
        await wait(REPAINT_MS);
      }

      // Flush any pending data, then stop. Without `requestData()` Safari
      // sometimes ships a file missing its trailing metadata.
      try {
        recorder.requestData();
      } catch {}
      await wait(60);
      recorder.stop();
      await stopped;

      return {
        blob: new Blob(chunks, { type: mime || "video/webm" }),
        ext,
        mime: mime || "video/webm",
      };
    } catch (e) {
      console.error(e);
      alert("Couldn't create the video. Try again.");
      setExportStatus(null);
      return null;
    }
  }

  async function saveVideo() {
    if (!gift || frameUrls.length === 0 || exportStatus) return;
    const startedAt = Date.now();
    track("export_started", { format: "mp4" });
    const result = await encodeVideo(
      regularLayout(),
      "video",
      "Building video…"
    );
    if (!result) {
      track("export_failed", { format: "mp4", reason: "encode_failed" });
      return;
    }
    await saveOrShare(
      result.blob,
      `doodlewish-${gift.recipient_name ?? "gift"}.${result.ext}`
    );
    track("export_saved", {
      format: "mp4",
      duration_ms: Date.now() - startedAt,
    });
    setExportStatus(null);
  }

  /**
   * Build an IG-Story-sized MP4 (1080×1920) and save it to the camera roll.
   * iOS / Android with Web Share API → share sheet → "Save Video".
   * Desktop / unsupported → plain download. The user then manually uploads
   * this clip as a Story (a true deep-link into IG isn't possible from web).
   */
  async function saveIGStoryVideo() {
    if (!gift || frameUrls.length === 0 || exportStatus) return;
    const startedAt = Date.now();
    track("export_started", { format: "ig_story" });
    const result = await encodeVideo(
      igStoryLayout(),
      "ig",
      "Building IG story video…"
    );
    if (!result) {
      track("export_failed", { format: "ig_story", reason: "encode_failed" });
      return;
    }
    await saveOrShare(
      result.blob,
      `doodlewish-${gift.recipient_name ?? "gift"}-story.${result.ext}`
    );
    track("export_saved", {
      format: "ig_story",
      duration_ms: Date.now() - startedAt,
    });
    setExportStatus(null);
  }

  function wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Try to share-as-file (iOS / Android offer "Save Image" / "Save Video"
   * which lands in the camera roll). Fall back to a regular download.
   */
  async function saveOrShare(blob: Blob, filename: string) {
    const file = new File([blob], filename, { type: blob.type });
    const recipient = gift?.recipient_name?.trim();
    const shareText = recipient
      ? `A DoodleWish for ${recipient} — scribbled together by friends. 🎂✨ #DoodleWish`
      : "A DoodleWish — scribbled together by friends. 🎂✨ #DoodleWish";
    // Desktop browsers don't offer a useful "save to disk" via the Web Share
    // API — go straight to a download. Mobile gets the share sheet (which on
    // iOS/Android includes Save Image / Save Video to the camera roll).
    const isTouch =
      typeof navigator !== "undefined" &&
      ((navigator.maxTouchPoints ?? 0) > 0 ||
        (typeof window !== "undefined" &&
          window.matchMedia?.("(pointer: coarse)").matches));
    if (isTouch) {
      try {
        if (
          typeof navigator !== "undefined" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] }) &&
          typeof navigator.share === "function"
        ) {
          await navigator.share({
            files: [file],
            title: "DoodleWish",
            text: shareText,
          });
          return;
        }
      } catch (e) {
        // User cancelled the share sheet → AbortError. Don't fall back to a
        // forced download in that case.
        if ((e as DOMException)?.name === "AbortError") return;
      }
    }
    // Plain download (desktop / unsupported browsers)
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ----------------- Render ----------------- */

  if (notFound) {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex flex-col items-center justify-center px-5 text-center">
        <p className="font-bold text-[24px] text-dw-fg">Not available yet</p>
        <p className="font-normal text-[14px] text-dw-gray mt-2">
          This gift is still being prepared.
        </p>
      </main>
    );
  }

  if (!gift) {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex items-center justify-center">
        <span
          className="inline-block w-10 h-10 rounded-full border-[3px] border-dw-fg/20 border-t-dw-fg animate-spin"
          aria-label="Loading"
        />
      </main>
    );
  }

  const exporting = !!exportStatus;

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="px-5 pt-4 flex-1 overflow-y-auto flex flex-col justify-center lg:max-w-[720px] lg:mx-auto lg:w-full lg:px-8">
        <div
          className="relative bg-dw-card rounded-card overflow-hidden w-full"
          style={{ aspectRatio: `${frameAspect}` }}
        >
          {frameUrls.length > 0 ? (
            currentFrame === 0 ? (
              // Empty-cake intro — rendered into a canvas of the EXACT
              // same dimensions as the first frame snapshot, with the
              // cake drawn at the same `fitFactor` + centered. The
              // resulting PNG goes through the same `object-cover`
              // pipeline as the decorated frames so the swap is
              // pixel-stable.
              introCakeUrl ? (
                <img
                  src={introCakeUrl}
                  alt="Empty cake"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#FAF8F6]" />
              )
            ) : (
              <img
                src={frameUrls[currentFrame - 1]}
                alt={`${gift.recipient_name}'s gift frame ${currentFrame}`}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="font-medium text-[14px] text-dw-gray">
                No frames yet.
              </p>
            </div>
          )}

          {frameUrls.length > 0 && currentFrame > 0 && (
            <div className="absolute top-1 right-3 bg-dw-card/90 border border-dw-fg/20 rounded-pill px-3 h-[28px] flex items-center">
              <span className="font-semibold text-[12px] text-dw-fg">
                {currentFrame} / {frameUrls.length}
              </span>
            </div>
          )}

          {exportStatus && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="bg-white rounded-card px-4 py-3 text-center">
                <p className="font-semibold text-[14px] text-dw-fg">
                  {exportStatus.label} {exportStatus.progress}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-safe pt-4 bg-dw-bg border-t border-dw-fg/10 shrink-0 lg:max-w-3xl lg:mx-auto lg:w-full lg:border-t-0">
        {frameUrls.length > 0 && (
          <div className="mb-3">
            <OutlineButton
              onClick={() => setShowSaveSheet(true)}
              fullWidth
              disabled={exporting}
            >
              {exporting ? exportStatus?.label ?? "Saving…" : "Save"}
            </OutlineButton>
          </div>
        )}
        <PrimaryButton onClick={() => router.push("/")}>
          Create your own gift
        </PrimaryButton>
      </div>

      {/* Save format chooser — bottom sheet on mobile, centered modal on desktop */}
      {showSaveSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end lg:items-center lg:justify-center lg:p-6"
          onClick={() => setShowSaveSheet(false)}
        >
          <div
            className="w-full max-w-[430px] mx-auto bg-white rounded-t-[20px] lg:rounded-[20px] lg:max-w-[440px] lg:pt-2 lg:shadow-2xl"
            style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1 lg:hidden">
              <div className="w-[39px] h-[4px] bg-dw-fg/30 rounded-pill" />
            </div>
            <p className="text-center font-semibold text-[16px] text-dw-fg mt-1 mb-3">
              Save your gift
            </p>
            <SheetRow
              label="Save for Instagram Story"
              hint="1080×1920 portrait MP4 sized for IG Stories. Saves to your Photos."
              onClick={() => {
                setShowSaveSheet(false);
                void saveIGStoryVideo();
              }}
            />
            <SheetDivider />
            <SheetRow
              label="Save as MP4 (video)"
              hint="2-second portrait video. Opens share sheet → Save Video to Photos."
              onClick={() => {
                setShowSaveSheet(false);
                void saveVideo();
              }}
            />
            <SheetDivider />
            <SheetRow
              label="Save as GIF"
              hint="Looping image. Works everywhere."
              onClick={() => {
                setShowSaveSheet(false);
                void saveGif();
              }}
            />
            <div className="px-4 pt-3">
              <OutlineButton
                onClick={() => setShowSaveSheet(false)}
                className="w-full"
              >
                Cancel
              </OutlineButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SheetRow({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left px-5 py-3.5 cursor-pointer",
        "active:bg-dw-card/60 transition-colors"
      )}
    >
      <p className="font-semibold text-[15px] text-dw-fg">{label}</p>
      <p className="font-normal text-[12px] text-dw-gray mt-0.5">{hint}</p>
    </button>
  );
}

function SheetDivider() {
  return <div className="h-px bg-dw-fg/10 mx-5" />;
}
