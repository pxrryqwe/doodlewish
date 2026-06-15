import { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export default function TextArea({ label, hint, className, ...props }: Props) {
  return (
    <div className="w-full">
      {label && (
        <label className="block font-semibold text-[14px] text-dw-fg mb-[6px]">
          {label}
        </label>
      )}
      <textarea
        {...props}
        className={cn(
          "w-full h-[100px] bg-transparent border border-dw-fg rounded-card px-4 py-3",
          "font-normal text-[16px] text-dw-fg placeholder:text-dw-gray resize-none",
          "outline-none focus:ring-2 focus:ring-dw-fg/30",
          className
        )}
      />
      {hint && (
        <p className="mt-1 font-normal text-[12px] text-dw-gray">{hint}</p>
      )}
    </div>
  );
}
