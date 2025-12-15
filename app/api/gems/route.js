// /app/api/gems/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

import {
  getGemsForUser,
  createGem,
  updateGem,
  deleteGem,
} from "@/lib/postgresChat";

// GET: list premade + my gems (with latest instructions)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const gems = await getGemsForUser(userId);

    return NextResponse.json({ gems }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("GET /gems error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST: create gem (+ version 1)
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = await req.json();

    const { name, description = "", instructions = "", icon = "", color = "" } = body || {};
    if (!String(name || "").trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const gem = await createGem(userId, { name, description, instructions, icon, color });
    return NextResponse.json({ gem }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("POST /gems error:", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

// PATCH: update gem metadata and/or create new version if instructions provided
export async function PATCH(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = await req.json();

    const { id, name, description, instructions, icon, color } = body || {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const gem = await updateGem(userId, id, { name, description, instructions, icon, color });
    return NextResponse.json({ gem }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("PATCH /gems error:", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

// DELETE: soft delete (my gems only)
export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.user.email.toLowerCase();
    const body = await req.json().catch(() => ({}));

    const { id } = body || {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await deleteGem(userId, id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("DELETE /gems error:", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}
