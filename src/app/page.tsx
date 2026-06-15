"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import OutlineButton from "@/components/ui/OutlineButton";
import TextField from "@/components/ui/TextField";

export default function HomePage() {
  const router = useRouter();
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [link, setLink] = useState("");

  function handleOpenLink() {
    if (!link.trim()) return;
    // Accept full URL or bare token
    try {
      const url = new URL(link.trim());
      router.push(url.pathname);
    } catch {
      // Bare token — try gift link first
      router.push(`/gift/${link.trim()}`);
    }
  }

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col lg:grid lg:grid-cols-[3fr_2fr] lg:gap-12 lg:items-center lg:px-12">
      <DoodleWishHeader variant="hero" />

      <div className="px-5 pt-4 pb-safe flex flex-col gap-3 shrink-0 lg:px-0 lg:py-0 lg:w-full lg:max-w-[420px] lg:mx-auto">
        <PrimaryButton onClick={() => router.push("/create/select")}>
          Create a gift
        </PrimaryButton>

        {showLinkInput ? (
          <div className="flex flex-col gap-2">
            <TextField
              placeholder="Paste your gift link or token"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleOpenLink()}
              autoFocus
            />
            <OutlineButton onClick={handleOpenLink} disabled={!link.trim()}>
              Open →
            </OutlineButton>
          </div>
        ) : (
          <OutlineButton onClick={() => setShowLinkInput(true)}>
            I have a link
          </OutlineButton>
        )}
      </div>
    </main>
  );
}
