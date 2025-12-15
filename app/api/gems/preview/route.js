// /app/api/gems/preview/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Placeholder theo yêu cầu: UI preview panel chưa gọi Gemini
  return NextResponse.json({
    ok: true,
    placeholder: true,
    message: "Preview panel is placeholder (no Gemini call).",
  });
}
