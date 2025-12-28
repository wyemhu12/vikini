// /app/api/gems/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/features/auth/auth";
import { getGemsForUser, createGem, updateGem, deleteGem } from "@/lib/features/gems/gems";

interface GemRow {
  id: string;
  slug?: string | null;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  is_premade?: boolean;
  isPremade?: boolean;
  latestVersion?: number;
  instructions?: string;
  instruction?: string;
  [key: string]: unknown;
}

interface GemForClient {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  icon: string;
  color: string;
  isPremade: boolean;
  latestVersion: number;
  instructions: string;
}

interface CreateGemPayload {
  name?: string;
  description?: string;
  instruction?: string;
  icon?: string;
  color?: string;
  [key: string]: unknown;
}

interface UpdateGemPayload extends CreateGemPayload {
  id?: string;
}

interface DeleteGemPayload {
  id?: string;
  [key: string]: unknown;
}

function mapGemForClient(row: GemRow | null): GemForClient | null {
  if (!row) return null;

  const isPremade = row.is_premade === true || row.isPremade === true;

  return {
    id: row.id,
    slug: row.slug ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    icon: row.icon ?? "",
    color: row.color ?? "",
    // UI expects camelCase + versioned fields
    isPremade,
    latestVersion: typeof row.latestVersion === "number" ? row.latestVersion : 0,
    instructions:
      (typeof row.instructions === "string" && row.instructions) ||
      (typeof row.instruction === "string" && row.instruction) ||
      "",
  };
}

// ------------------------------
// GET: list premade + my gems (with latest instructions)
// ------------------------------
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();

    const gems = await getGemsForUser(userId);
    const mapped = (Array.isArray(gems) ? gems : []).map(mapGemForClient).filter((g): g is GemForClient => g !== null);

    return NextResponse.json({ gems: mapped }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const error = e as Error;
    console.error("GET /gems error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// POST: create a custom gem (creates version 1 if gem_versions exists)
// ------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = (await req.json().catch(() => ({}))) as CreateGemPayload;

    const gem = await createGem(userId, body);
    return NextResponse.json({ gem: mapGemForClient(gem as GemRow) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const error = e as Error;
    console.error("POST /gems error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// PATCH: update a custom gem (creates a new version if instructions provided)
// ------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = (await req.json().catch(() => ({}))) as UpdateGemPayload;

    const { id, ...rest } = body || {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const gem = await updateGem(userId, id, rest);
    return NextResponse.json({ gem: mapGemForClient(gem as GemRow) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const error = e as Error;
    console.error("PATCH /gems error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

// ------------------------------
// DELETE: delete a custom gem (premade is read-only)
// ------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = (await req.json().catch(() => ({}))) as DeleteGemPayload;

    const { id } = body || {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await deleteGem(userId, id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const error = e as Error;
    console.error("DELETE /gems error:", error);
    return NextResponse.json({ error: error?.message || "Internal error" }, { status: 500 });
  }
}

