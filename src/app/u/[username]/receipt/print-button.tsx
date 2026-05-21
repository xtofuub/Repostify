"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/55 hover:text-white transition-colors"
    >
      Print
    </button>
  );
}
