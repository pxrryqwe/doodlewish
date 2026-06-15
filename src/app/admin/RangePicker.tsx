"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { label: "Today", value: "1" },
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
];

export default function RangePicker({ current }: { current: number }) {
  const router = useRouter();
  const search = useSearchParams();
  return (
    <div className="flex gap-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => {
            const p = new URLSearchParams(search.toString());
            p.set("range", o.value);
            router.push(`/admin?${p.toString()}`);
          }}
          className={`px-2 py-1 rounded text-[12px] font-medium ${
            String(current) === o.value
              ? "bg-dw-fg text-white"
              : "bg-dw-card text-dw-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
