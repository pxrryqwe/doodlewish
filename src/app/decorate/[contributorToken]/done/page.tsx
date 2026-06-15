"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import { getBaseUrl, copyText } from "@/lib/utils";
import { getGiftByAnyToken } from "@/lib/localStore";

export default function DonePage() {
  const { contributorToken } = useParams<{ contributorToken: string }>();
  const router = useRouter();
  const [recipientName, setRecipientName] = useState("their");
  const [dashboardToken, setDashboardToken] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedDashboard, setCopiedDashboard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getGiftByAnyToken(contributorToken);
      if (cancelled) return;
      if (data?.gift?.recipient_name) setRecipientName(data.gift.recipient_name);
      if (data?.gift?.dashboard_token) setDashboardToken(data.gift.dashboard_token);
      const ownerToken = localStorage.getItem("dw_owner_contributor_token");
      setIsOwner(ownerToken === contributorToken);
    })();
    return () => { cancelled = true; };
  }, [contributorToken]);

  async function shareContributorLink() {
    const link = `${getBaseUrl()}/gift/${contributorToken}`;
    const ok = await copyText(link);
    if (!ok) {
      alert(`Copy this link:\n${link}`);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyDashboardLink() {
    if (!dashboardToken) return;
    const link = `${getBaseUrl()}/dashboard/${dashboardToken}`;
    const ok = await copyText(link);
    if (!ok) {
      alert(`Copy this link:\n${link}`);
      return;
    }
    setCopiedDashboard(true);
    setTimeout(() => setCopiedDashboard(false), 2000);
  }

  function sendToRecipient() {
    if (!dashboardToken) return;
    router.push(`/dashboard/${dashboardToken}`);
  }

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-4 lg:max-w-[560px] lg:mx-auto lg:w-full">
        <div className="w-[79px] h-[79px] rounded-full bg-dw-fg flex items-center justify-center mb-2">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M8 20L16 28L32 12"
              stroke="white"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-bold text-[32px] text-dw-fg">Frame saved.</h1>
        <p className="font-normal text-[16px] text-dw-gray max-w-[296px]">
          Your part of {recipientName}&rsquo;s cake is ready. They&rsquo;ll see it when
          the full gift is opened.
        </p>
      </div>

      <div className="px-5 pb-safe flex flex-col gap-3 shrink-0 lg:max-w-3xl lg:mx-auto lg:w-full">
        {isOwner && dashboardToken && (
          <div className="bg-dw-card rounded-card p-4">
            <p className="font-semibold text-[14px] text-dw-fg mb-2">
              Save this link to come back and send the gift later
            </p>
            <p className="font-normal text-[12px] text-dw-gray break-all mb-3">
              {`${getBaseUrl()}/dashboard/${dashboardToken}`}
            </p>
            <OutlineButton onClick={copyDashboardLink} className="h-[44px] text-[14px]">
              {copiedDashboard ? "Copied!" : "Copy dashboard link"}
            </OutlineButton>
          </div>
        )}
        <PrimaryButton onClick={shareContributorLink}>
          {copied ? "Copied!" : "Share to contributors"}
        </PrimaryButton>
        <OutlineButton onClick={sendToRecipient} disabled={!dashboardToken}>
          Send gift to {recipientName}
        </OutlineButton>
        {!isOwner && (
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-[14px] font-semibold text-dw-gray text-center mt-1 cursor-pointer"
          >
            Create a new gift
          </button>
        )}
      </div>
    </main>
  );
}
