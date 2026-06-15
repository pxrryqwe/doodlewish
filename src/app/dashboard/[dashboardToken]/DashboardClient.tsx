"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { Gift, Frame } from "@/types";
import { getBaseUrl, copyText } from "@/lib/utils";
import { track, shortHash } from "@/lib/analytics";
import {
  getDashboard,
  removeFrame as removeFrameLocal,
  finalizeGift,
} from "@/lib/localStore";

interface Props {
  dashboardToken: string;
}

export default function DashboardClient({ dashboardToken }: Props) {
  const router = useRouter();
  const [gift, setGift] = useState<Gift | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRecipient, setCopiedRecipient] = useState(false);
  const [copiedDashboard, setCopiedDashboard] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getDashboard(dashboardToken);
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGift(data.gift);
      setFrames(data.frames);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dashboardToken]);

  if (loading) {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex items-center justify-center">
        <p className="font-medium text-[16px] text-dw-gray">Loading…</p>
      </main>
    );
  }

  if (notFound || !gift) {
    return (
      <main className="phone-shell bg-dw-bg min-h-dvh flex flex-col items-center justify-center px-5 text-center">
        <p className="font-bold text-[24px] text-dw-fg">Dashboard not found</p>
        <p className="font-normal text-[14px] text-dw-gray mt-2">
          This link is invalid or has expired.
        </p>
      </main>
    );
  }

  const contributorLink = `${getBaseUrl()}/gift/${gift.contributor_token}`;
  const dashboardLink = `${getBaseUrl()}/dashboard/${dashboardToken}`;

  async function copyDashboardLink() {
    const ok = await copyText(dashboardLink);
    if (!ok) {
      alert(`Copy this link:\n${dashboardLink}`);
      return;
    }
    track("link_copied", { kind: "dashboard" });
    setCopiedDashboard(true);
    setTimeout(() => setCopiedDashboard(false), 2000);
  }

  async function copyLink() {
    const ok = await copyText(contributorLink);
    if (!ok) {
      alert(`Copy this link:\n${contributorLink}`);
      return;
    }
    track("link_copied", { kind: "contributor" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function removeFrame(frameId: string) {
    if (await removeFrameLocal(dashboardToken, frameId)) {
      setFrames((f) => f.filter((fr) => fr.id !== frameId));
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError("");
    try {
      if (!(await finalizeGift(dashboardToken))) throw new Error("fail");
      const data = await getDashboard(dashboardToken);
      if (data) {
        setGift(data.gift);
        track("gift_sent", {
          gift_id_hash: shortHash(data.gift.id),
          frame_count: data.frames.length,
        });
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setFinalizing(false);
    }
  }

  const isSent = gift.status === "sent" || gift.status === "opened";

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="px-5 pt-3 flex flex-col flex-1 gap-6 overflow-y-auto md:px-8 lg:px-12 lg:max-w-[1040px] lg:mx-auto lg:w-full">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="lg:shrink-0">
            <h1 className="font-bold text-[28px] text-dw-fg leading-tight">
              {gift.recipient_name}&rsquo;s gift
            </h1>
            <p className="font-normal text-[14px] text-dw-gray mt-1">
              {frames.length} frame{frames.length !== 1 ? "s" : ""} added
            </p>
          </div>

          {!isSent && (
            <>
              {/* Mobile: full share-link card */}
              <div className="bg-dw-card rounded-card p-4 lg:hidden">
                <p className="font-semibold text-[14px] text-dw-fg mb-2">
                  Share this link with friends
                </p>
                <p className="font-normal text-[12px] text-dw-gray break-all mb-3">
                  {contributorLink}
                </p>
                <OutlineButton onClick={copyLink} className="h-[44px] text-[14px]">
                  {copied ? "Copied!" : "Copy contributor link"}
                </OutlineButton>
              </div>

              {/* Desktop: just the copy-link button */}
              <div className="hidden lg:block lg:max-w-[260px] lg:w-full">
                <OutlineButton onClick={copyLink} className="h-[44px] text-[14px]">
                  {copied ? "Copied!" : "Copy contributor link"}
                </OutlineButton>
              </div>
            </>
          )}
        </div>

        {!isSent && (
          <div className="bg-dw-card rounded-card p-4">
            <p className="font-semibold text-[14px] text-dw-fg mb-2">
              Your dashboard link — bookmark to come back
            </p>
            <p className="font-normal text-[12px] text-dw-gray break-all mb-3">
              {dashboardLink}
            </p>
            <OutlineButton onClick={copyDashboardLink} className="h-[44px] text-[14px]">
              {copiedDashboard ? "Copied!" : "Copy dashboard link"}
            </OutlineButton>
          </div>
        )}

        {frames.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-semibold text-[14px] text-dw-fg">Frames</p>
            <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-3 lg:grid-cols-3">
            {frames.map((frame, i) => (
              <div
                key={frame.id}
                className="flex items-center justify-between bg-dw-card rounded-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {frame.snapshot_url && (
                    <img
                      src={frame.snapshot_url}
                      alt={`Frame ${i + 1}`}
                      className="w-12 h-12 rounded-md object-cover bg-white"
                    />
                  )}
                  <div>
                    <p className="font-medium text-[14px] text-dw-fg">
                      Frame {i + 1}
                    </p>
                    <p className="font-normal text-[12px] text-dw-gray">
                      {new Date(frame.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!isSent && (
                  <button
                    onClick={() => removeFrame(frame.id)}
                    className="text-[13px] font-medium text-red-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            </div>
          </div>
        )}

        {gift.status === "collecting" && frames.length === 0 && (
          <p className="font-normal text-[14px] text-dw-gray text-center mt-8">
            No frames yet. Share the link so friends can start decorating!
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="px-5 pb-safe pt-4 flex flex-col gap-3 shrink-0 md:px-8 lg:px-12 lg:max-w-[1040px] lg:mx-auto lg:w-full">
        {isSent ? (
          <div className="bg-dw-card rounded-card p-4 text-center">
            <p className="font-semibold text-[16px] text-dw-fg">
              Gift sent! 🎉
            </p>
            <p className="font-normal text-[13px] text-dw-gray mt-1">
              Share this with {gift.recipient_name}:
            </p>
            <p className="font-normal text-[12px] text-dw-gray break-all mt-1">
              {getBaseUrl()}/open/{gift.recipient_token}
            </p>
            <OutlineButton
              onClick={async () => {
                const link = `${getBaseUrl()}/open/${gift.recipient_token}`;
                const ok = await copyText(link);
                if (!ok) {
                  alert(`Copy this link:\n${link}`);
                  return;
                }
                track("link_copied", { kind: "recipient" });
                setCopiedRecipient(true);
                setTimeout(() => setCopiedRecipient(false), 2000);
              }}
              className="h-[40px] text-[13px] mt-3"
            >
              {copiedRecipient ? "Copied!" : "Copy recipient link"}
            </OutlineButton>
          </div>
        ) : (
          <PrimaryButton
            onClick={finalize}
            disabled={frames.length === 0 || finalizing}
          >
            {finalizing
              ? "Generating gift…"
              : `Send to ${gift.recipient_name} →`}
          </PrimaryButton>
        )}
      </div>
    </main>
  );
}

