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

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabaseAdmin
    .from("badges")
    .select("id, name, description, image_url, virtud, frase, display_order")
    .is("deleted_at", null)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.error("GET /api/super-admin/badges:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ badges: data || [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const { name, description, image_url, virtud, frase, display_order } = body;
  if (!name || typeof name !== "string")
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  const { data, error } = await auth.supabaseAdmin
    .from("badges")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url?.trim() || null,
      virtud: virtud?.trim() || null,
      frase: frase?.trim() || null,
      display_order: typeof display_order === "number" ? display_order : 0,
    })
    .select("id, name, description, image_url, virtud, frase, display_order")
    .single();
  if (error) {
    console.error("POST /api/super-admin/badges:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ badge: data }, { status: 201 });
}
