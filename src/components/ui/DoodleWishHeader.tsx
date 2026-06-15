"use client";

const STAR_IMG = "/star.png";

interface Props {
  variant?: "hero" | "compact";
}

export default function DoodleWishHeader({ variant = "compact" }: Props) {
  if (variant === "hero") {
    return (
      <div className="relative w-full flex-1 flex flex-col justify-end">
        {/* Star doodle image — top right on mobile, above the wordmark on desktop */}
        <div className="absolute right-0 top-[8%] w-[55%] max-w-[260px] aspect-square overflow-hidden pointer-events-none lg:static lg:right-auto lg:top-auto lg:w-[220px] lg:max-w-none lg:mx-5 lg:mb-2">
          <img
            src={STAR_IMG}
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
        {/* Big wordmark — anchored to bottom of hero */}
        <div className="px-5 pb-4">
          <h1 className="font-extrabold text-[52px] tracking-[-1.56px] text-dw-fg leading-[48px]">
            Doodle
            <br />
            Wish.
          </h1>
          <div className="mt-3 mb-0 w-[50px] border-t border-dw-fg" />
          <p className="mt-3 font-normal text-[16px] tracking-[-0.48px] text-dw-fg">
            Wishes you can scribble together.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col items-center pb-2 shrink-0"
      style={{ paddingTop: "max(16px, calc(env(safe-area-inset-top) + 6px))" }}
    >
      <p className="font-normal text-[14px] tracking-[-0.42px] text-dw-fg">
        Wishes you can scribble together.
      </p>
      <div className="flex items-center gap-1 mt-0">
        <span className="font-extrabold text-[24px] tracking-[-0.72px] text-dw-fg leading-[20px]">
          Doodle
          <br />
          Wish.
        </span>
        <div className="relative w-[54px] h-[53px] overflow-hidden pointer-events-none ml-1">
          <img
            src={STAR_IMG}
            alt=""
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}
