import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import packageJson from "../../../package.json";
import { LogoMark } from "@/components/brand";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage Repostify updates, TikTok connection, cache, and diagnostics.",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <nav className="border-b border-white/8 bg-[#0a0a0b]/95">
        <div className="mx-auto flex h-16 w-full max-w-[72rem] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-[17px] font-semibold tracking-tight">
              Repostify
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25f4ee]/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[72rem] px-6 py-12 md:py-16">
        <div className="max-w-[44rem]">
          <h1 className="text-[32px] font-semibold tracking-[-0.025em]">
            Settings
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-white/55">
            App updates, saved TikTok access, scan cache, and local diagnostics.
          </p>
        </div>
        <SettingsPanel sourceVersion={packageJson.version} />
      </main>
    </div>
  );
}
