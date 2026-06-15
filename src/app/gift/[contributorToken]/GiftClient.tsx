"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import TextField from "@/components/ui/TextField";
import { Gift } from "@/types";
import { getGiftByAnyToken } from "@/lib/localStore";
import { track, shortHash } from "@/lib/analytics";

export default function GiftLandingPage() {
  const { contributorToken } = useParams<{ contributorToken: string }>();
  const router = useRouter();
  const [gift, setGift] = useState<Gift | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getGiftByAnyToken(contributorToken);
      if (cancelled) return;
      if (!data) { setNotFound(true); setLoading(false); return; }
      setGift(data.gift);
      setFrameCount(data.frameCount);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [contributorToken]);

  function handleJoin() {
    if (!name.trim()) return;
    setJoining(true);
    sessionStorage.setItem("dw_contributor_name", name.trim());
    if (gift) {
      track("gift_joined", {
        gift_id_hash: shortHash(gift.id),
        frame_index: frameCount,
      });
    }
    router.push(`/decorate/${contributorToken}`);
  }

  if (loading) return <LoadingShell />;
  if (notFound || !gift) return <NotFoundShell />;

  if (gift.status === "sent" || gift.status === "opened") {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex flex-col items-center justify-center px-5 text-center">
        <p className="font-bold text-[24px] text-dw-fg">This gift is already on its way!</p>
        <p className="font-normal text-[14px] text-dw-gray mt-2">
          {gift.recipient_name}&rsquo;s gift has been finalized. No more contributions.
        </p>
      </main>
    );
  }

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="px-5 pt-4 flex flex-col flex-1 overflow-y-auto lg:px-12 lg:max-w-[560px] lg:mx-auto lg:w-full">
        <h1 className="font-bold text-[32px] text-dw-fg leading-tight mb-4">
          You&rsquo;ve been invited to decorate {gift.recipient_name}&rsquo;s cake
        </h1>

        <div className="border-t border-dw-fg/20 my-4" />

        <ul className="flex flex-col gap-2 mb-8">
          {[
            `${frameCount} friend${frameCount !== 1 ? "s" : ""} added their touch already.`,
            "You'll see the cake as it is right now.",
            "Your frame becomes part of the story.",
          ].map((line) => (
            <li
              key={line}
              className="font-medium text-[16px] text-dw-fg flex gap-3"
            >
              <span className="shrink-0">——</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <TextField
          label="Your Name"
          placeholder="e.g. Mink"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          hint={`Shown to ${gift.recipient_name} alongside everyone else`}
        />
      </div>

      <div className="px-5 pb-safe pt-6 flex flex-col gap-4 shrink-0 lg:px-12 lg:max-w-[560px] lg:mx-auto lg:w-full">
        <PrimaryButton onClick={handleJoin} disabled={!name.trim() || joining}>
          {joining ? "Loading…" : `Join decorating ${gift.recipient_name}'s cake`}
        </PrimaryButton>
        <button
          onClick={() => router.push("/")}
          className="text-[14px] font-semibold text-dw-gray text-center"
        >
          Decline quietly
        </button>
      </div>
    </main>
  );
}

function LoadingShell() {
  return (
    <main className="phone-shell bg-dw-bg min-h-dvh flex items-center justify-center">
      <p className="font-medium text-[16px] text-dw-gray">Loading…</p>
    </main>
  );
}

function NotFoundShell() {
  return (
    <main className="phone-shell bg-dw-bg min-h-dvh flex flex-col items-center justify-center px-5 text-center">
      <p className="font-bold text-[24px] text-dw-fg">Link not found</p>
      <p className="font-normal text-[14px] text-dw-gray mt-2">
        This gift link is invalid or has expired.
      </p>
    </main>
  );
}
