import { NextRequest } from "next/server";
import {
  cancelLogin,
  getLoginState,
  logout,
  startLogin,
} from "@/lib/tiktok-login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Launching a visible browser needs a desktop session on the host, so this
// only makes sense when self-hosting / running locally. Block in production.
function blockedInProd(): Response | null {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.REPOSTIFY_DESKTOP !== "1"
  ) {
    return Response.json(
      { error: "Login is only available when running locally." },
      { status: 403 },
    );
  }
  return null;
}

// GET: current login/connection state (poll this from the UI).
export async function GET() {
  return Response.json(getLoginState());
}

// POST: { action: "start" | "cancel" | "logout" }
export async function POST(req: NextRequest) {
  const blocked = blockedInProd();
  if (blocked) return blocked;

  let action = "start";
  try {
    const body = await req.json();
    if (typeof body?.action === "string") action = body.action;
  } catch {
    // default to start
  }

  if (action === "start") {
    return Response.json(startLogin());
  }
  if (action === "cancel") {
    await cancelLogin();
    return Response.json(getLoginState());
  }
  if (action === "logout") {
    await logout();
    return Response.json(getLoginState());
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
