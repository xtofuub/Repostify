import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn("w-7 h-7", className)}
    >
      <rect width="32" height="32" rx="6" fill="#0f0f10" />
      <text
        x="16"
        y="23"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontWeight="500"
        fontSize="22"
        fill="#ffffff"
        letterSpacing="-0.5"
      >
        R
      </text>
      <rect x="22" y="20" width="3" height="3" fill="#25f4ee" />
    </svg>
  );
}

type PrimaryButtonProps = {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
} & ComponentProps<"button">;

export function PrimaryButton({
  children,
  size = "md",
  className,
  ...rest
}: PrimaryButtonProps) {
  const sizes = {
    sm: "h-9 px-4 text-[13px]",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-[15px]",
  } as const;
  return (
    <button
      {...rest}
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg font-medium",
        "bg-white text-[#0a0a0b] transition-all",
        "hover:bg-white/90 active:scale-[0.98]",
        "border border-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white",
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  size = "md",
  className,
  ...rest
}: PrimaryButtonProps) {
  const sizes = {
    sm: "h-9 px-4 text-[13px]",
    md: "h-11 px-5 text-sm",
    lg: "h-12 px-6 text-[15px]",
  } as const;
  return (
    <button
      {...rest}
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg font-medium",
        "border border-white/15 bg-white/[0.02] text-white transition-all",
        "hover:bg-white/[0.06] hover:border-white/25 active:scale-[0.98]",
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionLabel({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] uppercase text-white/55">
      <span className="block w-6 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <span>{children}</span>
      {accent && (
        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] tracking-normal normal-case text-white/45">
          {accent}
        </span>
      )}
    </div>
  );
}

export function GuideLines() {
  return (
    <>
      <div className="hidden lg:block pointer-events-none fixed inset-y-0 left-1/2 -translate-x-[calc(50%+34rem)] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent z-[5]" />
      <div className="hidden lg:block pointer-events-none fixed inset-y-0 left-1/2 translate-x-[calc(-50%+34rem)] w-px bg-gradient-to-b from-transparent via-white/10 to-transparent z-[5]" />
    </>
  );
}

export function BackgroundVideo({
  src,
  intensity = "default",
}: {
  src: string;
  intensity?: "default" | "subtle";
}) {
  const subtle = intensity === "subtle";

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <video
        autoPlay
        loop
        muted
        playsInline
        className={cn(
          "w-full h-full object-cover pointer-events-none",
          subtle ? "opacity-[0.22]" : "opacity-[0.55]",
        )}
        src={src}
      />
      <div
        className={cn(
          "absolute inset-0",
          subtle
            ? "bg-[radial-gradient(ellipse_at_top,rgba(10,10,11,0.58)_0%,rgba(10,10,11,0.88)_48%,#0a0a0b_82%)]"
            : "bg-[radial-gradient(ellipse_at_top,rgba(10,10,11,0.2)_0%,rgba(10,10,11,0.7)_45%,#0a0a0b_85%)]",
        )}
      />
    </div>
  );
}
