"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import StickerTray from "@/components/canvas/StickerTray";
import TrashOverlay from "@/components/canvas/TrashOverlay";
import CropModal from "@/components/canvas/CropModal";
import TextModal from "@/components/canvas/TextModal";
import InlineTextEditor from "@/components/canvas/InlineTextEditor";
import InlineDrawEditor from "@/components/canvas/InlineDrawEditor";
import DrawModal from "@/components/canvas/DrawModal";
import { Gift, Sticker, StickerLayer } from "@/types";
import { getContributorId } from "@/lib/utils";
import { getGiftByAnyToken, addFrame } from "@/lib/localStore";
import { track, shortHash } from "@/lib/analytics";
import {
  listCustomStickers,
  addCustomStickerFromDataUrl,
  removeCustomSticker,
} from "@/lib/customStickers";
import type { DecorationCanvasHandle } from "@/components/canvas/DecorationCanvas";

const CAKE_BASE_IMAGE = "/cake-no-candle.png";

const CAKE_TEMPLATE_CATEGORY = "Cake template";
const CAKE_TEMPLATE_IMAGES = [
  "/cake-no-candle.png",
  "/cake-no-candle-2.png",
  "/cake-no-candle-3.png",
  "/cake-no-candle-4.png",
  "/cake-no-candle-5.png",
  "/cake-no-candle-6.png",
  "/cake-no-candle-7.png",
];
const CAKE_TEMPLATE_STICKERS: Sticker[] = CAKE_TEMPLATE_IMAGES.map(
  (url, i) => ({
    id: `cake-template-${i}`,
    template_id: `cake-template-${i}`,
    image_url: url,
    category: CAKE_TEMPLATE_CATEGORY,
    weight: 0,
  })
);
const CAKE_TEMPLATE_URL_SET = new Set(CAKE_TEMPLATE_IMAGES);

// react-konva requires browser — load without SSR
const DecorationCanvas = dynamic(
  () => import("@/components/canvas/DecorationCanvas"),
  { ssr: false }
);

export default function DecoratePage() {
  const { contributorToken } = useParams<{ contributorToken: string }>();
  const router = useRouter();
  const [gift, setGift] = useState<Gift | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [customStickers, setCustomStickers] = useState<Sticker[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [baseImageUrl, setBaseImageUrl] = useState<string>(CAKE_BASE_IMAGE);
  const [baseImageMode, setBaseImageMode] = useState<"fit" | "fill">("fit");
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const canvasRef = useRef<DecorationCanvasHandle>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // Match the page background to the decorate container colour so there's
  // no contrast band on wide desktop screens.
  useEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = "var(--dw-card)";
    document.documentElement.style.backgroundColor = "var(--dw-card)";
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  // Drag-to-trash state (used by both canvas-placed stickers and tray custom tiles)
  const [trashActive, setTrashActive] = useState(false);
  const [trashHover, setTrashHover] = useState(false);
  const trashRef = useRef<HTMLDivElement>(null);

  // Crop modal state — opened after user picks an image to upload.
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showDrawModal, setShowDrawModal] = useState(false);

  function isOverTrash(clientX: number, clientY: number): boolean {
    const rect = trashRef.current?.getBoundingClientRect();
    if (!rect) return false;
    // Allow a little slop around the icon for easier targeting.
    const pad = 12;
    return (
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getGiftByAnyToken(contributorToken);
      if (cancelled) return;
      if (!data) { router.replace("/"); return; }
      setGift(data.gift);
      setStickers(data.stickers);
      setCustomStickers(await listCustomStickers());
      setFrameCount(data.frameCount);
      if (data.latestFrameUrl) {
        setBaseImageUrl(data.latestFrameUrl);
        setBaseImageMode("fill");
      } else {
        setBaseImageUrl(CAKE_BASE_IMAGE);
        setBaseImageMode("fit");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [contributorToken, router]);

  const handleCommit = useCallback(
    async (pngBlob: Blob, layers: StickerLayer[]) => {
      setCommitting(true);
      try {
        const contributorId = getContributorId();
        const contributorName =
          typeof window !== "undefined"
            ? sessionStorage.getItem("dw_contributor_name") ?? undefined
            : undefined;
        // Only forward the cake template when we're actually rendering a
        // template (vs. building on top of a previous frame snapshot).
        // The server only persists the first non-null value, so this
        // captures whichever template the first contributor picked.
        const cakeTemplate =
          baseImageMode === "fit" && CAKE_TEMPLATE_URL_SET.has(baseImageUrl)
            ? baseImageUrl
            : undefined;
        const result = await addFrame({
          contributorToken,
          contributorId,
          contributorName,
          cakeTemplate,
          pngBlob,
          layers,
        });
        if ("error" in result) throw new Error(result.error);
        if (gift) {
          track("frame_submitted", {
            gift_id_hash: shortHash(gift.id),
            sticker_count: layers.length,
            device: isDesktop ? "desktop" : "mobile",
          });
        }
        router.push(`/decorate/${contributorToken}/done`);
      } catch (e) {
        setCommitting(false);
        alert(
          e instanceof Error
            ? e.message
            : "Something went wrong saving your frame. Please try again."
        );
      }
    },
    [contributorToken, router, gift, isDesktop, baseImageMode, baseImageUrl]
  );

  function handleUpload(file: File) {
    // Don't save yet — open the crop modal first.
    setPendingCropFile(file);
  }

  async function saveAndDropSticker(dataUrl: string) {
    try {
      const sticker = await addCustomStickerFromDataUrl(dataUrl);
      setCustomStickers(await listCustomStickers());
      // Drop it on the canvas immediately so the user sees it in place.
      canvasRef.current?.addSticker(sticker.image_url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't add that sticker.");
    }
  }

  async function handleCropDone(dataUrl: string) {
    setPendingCropFile(null);
    await saveAndDropSticker(dataUrl);
  }

  async function handleTextDone(dataUrl: string) {
    setShowTextModal(false);
    await saveAndDropSticker(dataUrl);
  }

  async function handleDrawDone(dataUrl: string) {
    setShowDrawModal(false);
    await saveAndDropSticker(dataUrl);
  }

  if (loading || !gift) {
    return (
      <main className="phone-shell bg-dw-card min-h-dvh flex flex-col">
        <DoodleWishHeader variant="compact" />
        <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-6">
          <img
            src="/birthday-cake.png"
            alt="cake"
            className="w-[149px] h-[140px] object-contain animate-pulse"
          />
          <p className="font-semibold text-[20px] text-dw-fg">
            Preparing {gift?.recipient_name ?? "the"}&rsquo;s cake space…
          </p>
          <p className="font-normal text-[14px] text-dw-gray">
            One contributor can add one frame to the gift.
          </p>
        </div>
      </main>
    );
  }

  // Only the first contributor (the gift creator on their first commit)
  // is allowed to pick the cake template — afterwards everyone builds
  // on top of the previous frame, so swapping templates mid-stream
  // would wipe their decorations and reset the gift's stored template.
  const isFirstContributor = frameCount === 0;
  const mergedStickers = [
    ...customStickers,
    ...(isFirstContributor ? CAKE_TEMPLATE_STICKERS : []),
    ...stickers,
  ];

  function handleStickerSelect(url: string) {
    // Cake-template "stickers" swap the canvas base image instead of being
    // placed as a sticker layer.
    if (CAKE_TEMPLATE_URL_SET.has(url)) {
      setBaseImageUrl(url);
      setBaseImageMode("fit");
      return;
    }
    canvasRef.current?.addSticker(url);
  }

  return (
    <main className="phone-shell bg-dw-card min-h-dvh flex flex-col lg:flex-row lg:gap-6 lg:px-6 lg:py-6">
      {/* Sticker tray — bottom on mobile, left sidebar on desktop */}
      <aside className="order-2 lg:order-1 mt-2.5 lg:mt-0 lg:w-[340px] lg:shrink-0 lg:flex lg:flex-col lg:h-[calc(100dvh-3rem)] lg:sticky lg:top-6">
        <div className="hidden lg:block pb-3">
          <p className="font-semibold text-[20px] text-dw-fg">
            {gift.recipient_name}&rsquo;s Cake · Frame {frameCount + 1}
          </p>
        </div>
        <StickerTray
          variant="responsive"
          stickers={mergedStickers}
          onStickerSelect={handleStickerSelect}
          onUpload={handleUpload}
          onAddText={() => setShowTextModal(true)}
          onAddDrawing={() => setShowDrawModal(true)}
          onDeleteCustom={async (id) => {
            await removeCustomSticker(id);
            setCustomStickers(await listCustomStickers());
          }}
          onCustomDragStart={() => {
            setTrashActive(true);
            setTrashHover(false);
          }}
          onCustomDragMove={(cx, cy) => {
            setTrashHover(isOverTrash(cx, cy));
          }}
          onCustomDragEnd={(stickerId, cx, cy) => {
            const over = isOverTrash(cx, cy);
            setTrashActive(false);
            setTrashHover(false);
            if (over) {
              void removeCustomSticker(stickerId).then(async () => {
                setCustomStickers(await listCustomStickers());
              });
              return true;
            }
            return false;
          }}
        />
        <div
          className="bg-dw-tray px-5 pt-2 lg:hidden"
          style={{ paddingBottom: "max(2rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
        >
          <PrimaryButton onClick={() => canvasRef.current?.commit()} disabled={committing}>
            {committing ? "Saving…" : "Done & Save your frame"}
          </PrimaryButton>
        </div>
      </aside>

      {/* Right column on desktop: title + canvas + done button.
          Height matches the sidebar so canvas + done button = sticker tray height. */}
      <div className="order-1 lg:order-2 flex flex-col flex-1 min-h-0 lg:flex-1 lg:min-w-0 lg:h-[calc(100dvh-3rem)]">
        {/* Title — mobile only (desktop title sits above the sticker tray) */}
        <div className="px-5 pt-4 pb-2 lg:hidden">
          <p className="font-semibold text-[16px] text-dw-fg text-center">
            {gift.recipient_name}&rsquo;s Cake · Frame {frameCount + 1}
          </p>
        </div>

        {/* Spacer to align canvas top with the sticker-tray top in the sidebar
            (which sits below the desktop title). */}
        <div aria-hidden className="hidden lg:block pb-3">
          <p className="font-semibold text-[20px] leading-none invisible">·</p>
        </div>

        {/* Canvas — bigger drop zone on desktop, fills the full container.
            Mobile keeps aspect-fit behavior unchanged. `lg:relative` lets the
            desktop TrashOverlay anchor to this wrapper's bottom-left. */}
        <div className="px-5 flex-1 lg:px-0 lg:w-full lg:min-h-0 lg:relative">
          <DecorationCanvas
            ref={canvasRef}
            cakeImageUrl={baseImageUrl}
            baseImageMode={baseImageMode}
            fitMode={isDesktop ? "fill" : "aspect"}
            stickers={mergedStickers}
            onCommit={handleCommit}
            isCommitting={committing}
            onPlacedDragStart={() => {
              setTrashActive(true);
              setTrashHover(false);
            }}
            onPlacedDragMove={(cx, cy) => {
              setTrashHover(isOverTrash(cx, cy));
            }}
            shouldDeleteOnDragEnd={(cx, cy) => {
              const over = isOverTrash(cx, cy);
              setTrashActive(false);
              setTrashHover(false);
              return over;
            }}
            onPlacedDragEnd={() => {
              // Safety net in case shouldDeleteOnDragEnd is not called.
              setTrashActive(false);
              setTrashHover(false);
            }}
          />
          <TrashOverlay ref={trashRef} active={trashActive} hover={trashHover} />
          {isDesktop && showTextModal && (
            <InlineTextEditor
              onDone={handleTextDone}
              onCancel={() => setShowTextModal(false)}
            />
          )}
          {isDesktop && showDrawModal && (
            <InlineDrawEditor
              onDone={handleDrawDone}
              onCancel={() => setShowDrawModal(false)}
            />
          )}
        </div>

        {/* Done button — desktop only (mobile button lives in tray area) */}
        <div className="hidden lg:block pt-4 w-full">
          <PrimaryButton onClick={() => canvasRef.current?.commit()} disabled={committing}>
            {committing ? "Saving…" : "Done & Save your frame"}
          </PrimaryButton>
        </div>
      </div>

      {pendingCropFile && (
        <CropModal
          file={pendingCropFile}
          onDone={handleCropDone}
          onCancel={() => setPendingCropFile(null)}
        />
      )}

      {showTextModal && !isDesktop && (
        <TextModal
          onDone={handleTextDone}
          onCancel={() => setShowTextModal(false)}
        />
      )}

      {showDrawModal && !isDesktop && (
        <DrawModal
          onDone={handleDrawDone}
          onCancel={() => setShowDrawModal(false)}
        />
      )}
    </main>
  );
}
