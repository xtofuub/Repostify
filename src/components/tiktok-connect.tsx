"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, LogIn, LogOut, X } from "lucide-react";
import { toast } from "sonner";

type Phase =
  | "idle"
  | "opening"
  | "awaiting"
  | "saved"
  | "timeout"
  | "cancelled"
  | "error";

type LoginState = {
  phase: Phase;
  message: string;
  startedAt: number | null;
  connectedAt: number | null;
};

const BUSY: Phase[] = ["opening", "awaiting"];

async function fetchLoginState(): Promise<LoginState | null> {
  try {
    const res = await fetch("/api/login", { cache: "no-store" });
    return (await res.json()) as LoginState;
  } catch {
    return null;
  }
}

export function TikTokConnect() {
  const [state, setState] = useState<LoginState | null>(null);
  const [acting, setActing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchLoginState().then((next) => {
      if (!cancelled && next) setState(next);
    });
    return () => {
      cancelled = true;
      stopPoll();
    };
  }, [stopPoll]);

  // Poll while a login window is open.
  const startPolling = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const s = await fetchLoginState();
      if (s) setState(s);
      if (!s || !BUSY.includes(s.phase)) {
        stopPoll();
        if (s?.phase === "saved") toast.success("TikTok connected");
        if (s?.phase === "timeout") toast.error("Login timed out");
        if (s?.phase === "cancelled") toast("Login cancelled");
        if (s?.phase === "error") toast.error(s.message || "Login failed");
      }
    }, 1500);
  }, [stopPoll]);

  async function post(action: "start" | "cancel" | "logout") {
    setActing(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.status === 403) {
        toast.error("Login only works when running locally");
        return;
      }
      const json = (await res.json()) as LoginState;
      setState(json);
      if (action === "start") {
        toast("Browser window opening — log in there");
        startPolling();
      } else {
        stopPoll();
        if (action === "logout") toast("Disconnected");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setActing(false);
    }
  }

  const connected = !!state?.connectedAt;
  const busy = state ? BUSY.includes(state.phase) : false;

  if (busy) {
    return (
      <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em]">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#25f4ee]" />
        <span className="text-white/70">Waiting for login</span>
        <button
          onClick={() => post("cancel")}
          disabled={acting}
          className="inline-flex items-center gap-1 text-white/45 hover:text-white transition-colors"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="inline-flex items-center gap-3 text-[12px] uppercase tracking-[0.18em]">
        <span className="inline-flex items-center gap-1.5 text-[#25f4ee]">
          <Check className="h-3.5 w-3.5" />
          Connected
        </span>
        <button
          onClick={() => post("logout")}
          disabled={acting}
          className="inline-flex items-center gap-1 text-white/45 hover:text-white transition-colors"
        >
          <LogOut className="h-3 w-3" />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => post("start")}
      disabled={acting}
      className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-white/45 hover:text-white transition-colors disabled:opacity-50"
    >
      {acting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LogIn className="h-3.5 w-3.5" />
      )}
      Connect TikTok
    </button>
  );
}
