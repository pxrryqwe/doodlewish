"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { Gift } from "@/types";
import { getGiftByAnyToken, markOpened } from "@/lib/localStore";
import { track, shortHash } from "@/lib/analytics";
const CAKE_BASE_IMAGE = "/birthday-cake.png";

interface Props {
  recipientToken: string;
}

export default function RecipientClient({ recipientToken }: Props) {
  const router = useRouter();
  const [gift, setGift] = useState<Gift | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [contributorNames, setContributorNames] = useState<string[]>([]);
  const [showAllNames, setShowAllNames] = useState(false);
  const [status, setStatus] = useState<"loading" | "not-ready" | "not-found" | "ready">("loading");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getGiftByAnyToken(recipientToken);
      if (cancelled) return;
      if (!data || data.gift.recipient_token !== recipientToken) {
        setStatus("not-found");
        return;
      }
      setGift(data.gift);
      setFrameCount(data.frameCount);
      setContributorNames(data.contributorNames);
      if (data.gift.status !== "sent" && data.gift.status !== "opened") {
        setStatus("not-ready");
      } else {
        setStatus("ready");
      }
    })();
    return () => { cancelled = true; };
  }, [recipientToken]);

  async function openGift() {
    if (opening) return; // guard against double-taps
    setOpening(true);
    try {
      await markOpened(recipientToken);
      if (gift) {
        track("gift_opened", {
          gift_id_hash: shortHash(gift.id),
          frame_count: frameCount,
        });
      }
    } finally {
      router.push(`/reveal/${recipientToken}`);
    }
  }

  if (status === "loading") {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex items-center justify-center">
        <span
          className="inline-block w-10 h-10 rounded-full border-[3px] border-dw-fg/20 border-t-dw-fg animate-spin"
          aria-label="Loading"
        />
      </main>
    );
  }

  if (status === "not-found") {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex flex-col items-center justify-center px-5 text-center">
        <p className="font-bold text-[24px] text-dw-fg">Link not found</p>
        <p className="font-normal text-[14px] text-dw-gray mt-2">
          This gift link is invalid or has expired.
        </p>
      </main>
    );
  }

  if (status === "not-ready" || !gift) {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex flex-col items-center justify-center px-5 text-center">
        <p className="font-bold text-[28px] text-dw-fg">Not ready yet!</p>
        <p className="font-normal text-[14px] text-dw-gray mt-2">
          Your friends are still decorating. Check back soon.
        </p>
      </main>
    );
  }

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="flex-1 flex flex-col items-center px-5 pt-6 gap-4 overflow-y-auto lg:max-w-[640px] lg:mx-auto lg:w-full lg:px-12">
        <div className="w-[228px] h-[214px] overflow-hidden lg:w-[300px] lg:h-[280px]">
          <img
            src={CAKE_BASE_IMAGE}
            alt="A birthday cake"
            className="w-full h-full object-contain"
          />
        </div>

        {contributorNames.length > 0 && (
          <ContributorList
            names={contributorNames}
            onShowAll={() => setShowAllNames(true)}
          />
        )}

        <h1 className="font-bold text-[32px] text-dw-fg text-center leading-tight mt-2">
          {frameCount} friend{frameCount !== 1 ? "s" : ""} made you something
          special!
        </h1>

        {gift.note && (
          <p className="font-normal text-[16px] text-dw-fg text-center">
            &ldquo;{gift.note}&rdquo;
          </p>
        )}
      </div>

      <div className="px-5 pb-safe flex flex-col gap-3 shrink-0 lg:max-w-[420px] lg:mx-auto lg:w-full">
        <PrimaryButton onClick={openGift} disabled={opening}>
          Open your gift →
        </PrimaryButton>
        <p className="text-center font-normal text-[14px] text-dw-gray">
          This link stays valid, open it whenever you&rsquo;re ready.
        </p>
      </div>

      {showAllNames && (
        <AllNamesDialog
          names={contributorNames}
          onClose={() => setShowAllNames(false)}
        />
      )}

      {/* Single spinner veil while opening — blocks repeat taps. */}
      {opening && (
        <div
          className="fixed inset-0 z-50 bg-dw-bg/70 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
          aria-live="polite"
          aria-busy="true"
        >
          <span
            className="inline-block w-10 h-10 rounded-full border-[3px] border-dw-fg/20 border-t-dw-fg animate-spin"
            aria-label="Opening"
          />
        </div>
      )}
    </main>
  );
}

function ContributorList({
  names,
  onShowAll,
}: {
  names: string[];
  onShowAll: () => void;
}) {
  const shown = names.slice(0, 3);
  const remaining = names.length - shown.length;
  const formatted = shown.join(", ");
  return (
    <p className="font-medium text-[15px] text-dw-fg text-center mt-1">
      From {formatted}
      {remaining > 0 && (
        <>
          {" and "}
          <button
            type="button"
            onClick={onShowAll}
            className="underline underline-offset-2 font-semibold cursor-pointer"
          >
            {remaining} other{remaining > 1 ? "s" : ""}
          </button>
        </>
      )}
    </p>
  );
}

function AllNamesDialog({
  names,
  onClose,
}: {
  names: string[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center px-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-card w-full max-w-[400px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="font-bold text-[18px] text-dw-fg">
            Everyone who joined ({names.length})
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-dw-fg hover:bg-dw-fg/10 cursor-pointer"
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
        </div>
        <ul className="overflow-y-auto px-5 pb-5 flex flex-col gap-2">
          {names.map((n, i) => (
            <li
              key={`${n}-${i}`}
              className="font-medium text-[15px] text-dw-fg border-b border-dw-fg/10 last:border-b-0 py-2"
            >
              {n}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
