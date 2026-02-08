import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Rubros y escala de calificación para una academia
// Query: ?academy_id=uuid
// Escalas: evaluation_scales de la academia
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "director" && profile.role !== "professor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get("academy_id");

    if (!academyId) {
      return NextResponse.json({ error: "academy_id is required" }, { status: 400 });
    }

    if (profile.role !== "super_admin" && profile.academy_id !== academyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: er } = await supabaseAdmin
      .from("evaluation_rubrics")
      .select("id, name, display_order")
      .eq("academy_id", academyId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });
    const rubrics = (er || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      display_order: r.display_order ?? 0,
    }));

    const { data: scales } = await supabaseAdmin
      .from("evaluation_scales")
      .select("id, name, numeric_value, display_order")
      .eq("academy_id", academyId)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    const scaleList = (scales || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      numeric_value: s.numeric_value,
      display_order: s.display_order ?? 0,
    }));

    return NextResponse.json({ rubrics, scales: scaleList });
  } catch (e) {
    console.error("GET /api/evaluation-data:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
