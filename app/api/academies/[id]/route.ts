import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

async function requireSuperAdmin() {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { data: academy, error } = await auth.supabase
    .from("academies")
    .select("id, name, address, phone, website, status, currency")
    .eq("id", id)
    .single();

  if (error || !academy) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  return NextResponse.json({ academy });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const allowed = ["name", "address", "phone", "website", "currency"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  if (updates.currency && updates.currency !== "CRC" && updates.currency !== "EUR") {
    return NextResponse.json(
      { error: "Invalid currency. Must be CRC or EUR" },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error: updateError } = await auth.supabase
    .from("academies")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    console.error("Error updating academy:", updateError);
    return NextResponse.json(
      { error: "Failed to update academy", details: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
