import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

async function requireSuperAdmin() {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "super_admin")
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    return { error: NextResponse.json({ error: "Server error" }, { status: 500 }) };
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { supabaseAdmin: admin };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await request.json();
  const { name, description, image_url, virtud, frase, display_order } = body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (description !== undefined) updates.description = description ? String(description).trim() : null;
  if (image_url !== undefined) updates.image_url = image_url ? String(image_url).trim() : null;
  if (virtud !== undefined) updates.virtud = virtud ? String(virtud).trim() : null;
  if (frase !== undefined) updates.frase = frase ? String(frase).trim() : null;
  if (display_order !== undefined) updates.display_order = Number(display_order) || 0;
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  const { data, error } = await auth.supabaseAdmin
    .from("badges")
    .update(updates)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name, description, image_url, virtud, frase, display_order")
    .single();
  if (error) {
    console.error("PATCH /api/super-admin/badges/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Badge not found" }, { status: 404 });
  return NextResponse.json({ badge: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const { error } = await auth.supabaseAdmin
    .from("badges")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("DELETE /api/super-admin/badges/[id]:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
