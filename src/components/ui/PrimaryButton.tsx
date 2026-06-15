import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
}

export default function PrimaryButton({
  children,
  className,
  fullWidth = true,
  ...props
}: Props) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "h-[56px] bg-dw-fg text-white font-semibold text-[18px] rounded-card",
        "flex items-center justify-center cursor-pointer select-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:opacity-80 transition-opacity",
        fullWidth && "w-full",
        className
      )}
    >
      {children}
    </button>
  );
}
