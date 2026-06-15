"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  hover: boolean;
}

const TrashOverlay = forwardRef<HTMLDivElement, Props>(function TrashOverlay(
  { active, hover },
  ref
) {
  return (
    <div
      ref={ref}
      aria-hidden={!active}
      className={cn(
        "fixed left-1/2 -translate-x-1/2 bottom-[180px] z-50",
        // Desktop: pin to the bottom-center of the drag/drop zone
        // (the canvas wrapper, which is the closest positioned ancestor).
        "lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:bottom-4",
        "w-[64px] h-[64px] rounded-full flex items-center justify-center",
        "transition-all duration-150 pointer-events-none select-none",
        active ? "opacity-100 scale-100" : "opacity-0 scale-75",
        hover
          ? "bg-red-500 text-white scale-110 shadow-lg"
          : "bg-dw-fg/85 text-white"
      )}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    </div>
  );
});

export default TrashOverlay;
