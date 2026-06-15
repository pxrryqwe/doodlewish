"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DoodleWishHeader from "@/components/ui/DoodleWishHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { cn } from "@/lib/utils";

const CAKE_IMG = "/birthday-cake.png";

type Template = "birthday-cake";

export default function SelectGiftPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Template | null>("birthday-cake");

  return (
    <main className="phone-shell bg-dw-bg h-dvh flex flex-col">
      <DoodleWishHeader variant="compact" />

      <div className="px-5 pt-2 flex flex-col flex-1 overflow-y-auto md:px-8 lg:px-12 lg:max-w-[1040px] lg:mx-auto lg:w-full lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
        <h1 className="font-bold text-[28px] text-dw-fg leading-tight mb-6 text-center lg:text-left lg:text-[40px] lg:mb-0 lg:self-center">
          Select a gift
        </h1>

        <div className="grid grid-cols-2 gap-3 md:gap-5 md:max-w-[640px] md:mx-auto md:w-full lg:max-w-none lg:mx-0">
          {/* Birthday Cake — active */}
          <button
            onClick={() => setSelected("birthday-cake")}
            className={cn(
              "relative bg-dw-card rounded-card aspect-square overflow-hidden text-left transition",
              selected === "birthday-cake"
                ? "border-2 border-dw-fg"
                : "border border-dw-fg/15"
            )}
          >
            <span className="absolute top-3 left-3 font-semibold text-[20px] text-dw-fg leading-tight">
              Birthday
              <br />
              Cake.
            </span>
            <div className="h-0.5 w-6 bg-dw-fg absolute top-[72px] left-3"></div>
            <img
              src={CAKE_IMG}
              alt="Birthday cake"
              className="absolute bottom-4 right-4 w-[48%] h-auto object-contain"
            />
          </button>

          {/* Coming soon — top right */}
          <div className="flex bg-dw-card/60 rounded-card aspect-square border border-dw-fg/10 cursor-not-allowed h-full">
            <span className="text-[20px] self-center w-full text-center  font-semibold text-[#B1ADA780]">
              Coming soon
            </span>
          </div>

          {/* Coming soon — bottom left */}
          <div className="flex bg-dw-card/60 rounded-card aspect-square border border-dw-fg/10 cursor-not-allowed h-full">
            <span className="text-[20px] self-center w-full text-center  font-semibold text-[#B1ADA780]">
              Coming soon
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-safe pt-6 shrink-0 lg:px-12 lg:max-w-3xl lg:mx-auto lg:w-full">
        <PrimaryButton
          onClick={() => router.push("/create")}
          disabled={selected !== "birthday-cake"}
        >
          Continue with Birthday Cake →
        </PrimaryButton>
      </div>
    </main>
  );
}
