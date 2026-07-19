import {
  clearRepostCache,
  getRepostCacheStats,
} from "@/lib/repost-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canManageCache(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.REPOSTIFY_DESKTOP === "1"
  );
}

export async function GET() {
  return Response.json({
    ...(await getRepostCacheStats()),
    manageable: canManageCache(),
  });
}

export async function DELETE() {
  if (!canManageCache()) {
    return Response.json(
      { error: "Cache controls are only available in the desktop app." },
      { status: 403 },
    );
  }
  const cleared = await clearRepostCache();
  return Response.json({
    clearedEntries: cleared.entries,
    clearedBytes: cleared.bytes,
    ...(await getRepostCacheStats()),
    manageable: true,
  });
}
