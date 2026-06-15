"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import TextField from "@/components/ui/TextField";
import TextArea from "@/components/ui/TextArea";
import { createGift } from "@/lib/localStore";
import { track, shortHash } from "@/lib/analytics";

export default function CreatePage() {
  const router = useRouter();
  const [creatorName, setCreatorName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    if (!creatorName.trim() || !recipientName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { giftId, dashboardToken, contributorToken, recipientToken } = await createGift({
        creatorName: creatorName.trim(),
        recipientName: recipientName.trim(),
        note: note.trim() || null,
      });
      track("gift_created", {
        gift_id_hash: shortHash(giftId),
        has_note: !!note.trim(),
      });
      localStorage.setItem("dw_owner_dashboard_token", dashboardToken);
      localStorage.setItem("dw_owner_recipient_token", recipientToken);
      localStorage.setItem("dw_owner_contributor_token", contributorToken);
      sessionStorage.setItem("dw_contributor_name", creatorName.trim());
      router.push(`/decorate/${contributorToken}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const canContinue = creatorName.trim() && recipientName.trim();

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="px-5 pt-4 flex flex-col flex-1 overflow-y-auto lg:px-12 lg:max-w-[640px] lg:mx-auto lg:w-full">
        <button
          onClick={() => router.back()}
          className="text-[14px] font-semibold text-dw-fg mb-6 text-left w-fit"
        >
          ← Back
        </button>

        <h1 className="font-bold text-[32px] text-dw-fg leading-tight mb-2">
          A little about this gift.
        </h1>
        <p className="font-normal text-[14px] text-dw-gray mb-8">
          Contributors and the recipient will see this.
        </p>

        <div className="flex flex-col gap-6">
          <TextField
            label="Your Name"
            placeholder="e.g. Aom"
            value={creatorName}
            onChange={(e) => setCreatorName(e.target.value)}
          />

          <TextField
            label="Recipient's Name"
            placeholder="e.g. Priya"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />

          <TextArea
            label="Note"
            placeholder="e.g. For your 30th — with love 🤍"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            hint="Shown to the recipient before they open the gift."
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}
      </div>

      <div className="px-5 pb-safe pt-6 shrink-0 lg:px-12 lg:max-w-[640px] lg:mx-auto lg:w-full">
        <div className="w-full lg:mx-auto">
          <PrimaryButton
            onClick={handleContinue}
            disabled={!canContinue || loading}
          >
            {loading ? "Creating…" : "Start Decorating →"}
          </PrimaryButton>
        </div>
      </div>
    </main>
  );
}
