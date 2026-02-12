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

    const { data: arRows, error: arError } = await supabaseAdmin
      .from("academy_rubrics")
      .select("rubric_id")
      .eq("academy_id", academyId);
    if (arError) {
      console.error("Error fetching academy rubrics:", arError);
      return NextResponse.json(
        { error: "Error al cargar rúbricas", details: arError.message },
        { status: 500 }
      );
    }
    const rubricIds = (arRows || []).map((r: { rubric_id: string }) => r.rubric_id);

    let rubrics: { id: string; name: string; display_order: number }[] = [];
    if (rubricIds.length) {
      const { data: er, error: erErr } = await supabaseAdmin
        .from("evaluation_rubrics")
        .select("id, name, display_order")
        .in("id", rubricIds)
        .is("deleted_at", null)
        .order("display_order", { ascending: true });
      if (erErr) {
        console.error("Error fetching rubrics:", erErr);
        return NextResponse.json(
          { error: "Error al cargar rúbricas", details: erErr.message },
          { status: 500 }
        );
      }
      rubrics = (er || []).map((r: { id: string; name: string; display_order?: number }) => ({
        id: r.id,
        name: r.name,
        display_order: r.display_order ?? 0,
      }));
    }

    const { data: asRows, error: asError } = await supabaseAdmin
      .from("academy_scales")
      .select("scale_id")
      .eq("academy_id", academyId);
    if (asError) {
      console.error("Error fetching academy scales:", asError);
      return NextResponse.json(
        { error: "Error al cargar escalas", details: asError.message },
        { status: 500 }
      );
    }
    const scaleIds = (asRows || []).map((r: { scale_id: string }) => r.scale_id);

    let scaleList: { id: string; name: string; numeric_value: number; display_order: number }[] = [];
    if (scaleIds.length) {
      const { data: scales, error: scalesErr } = await supabaseAdmin
        .from("evaluation_scales")
        .select("id, name, numeric_value, display_order")
        .in("id", scaleIds)
        .is("deleted_at", null)
        .order("display_order", { ascending: true });
      if (scalesErr) {
        console.error("Error fetching scales:", scalesErr);
        return NextResponse.json(
          { error: "Error al cargar escalas", details: scalesErr.message },
          { status: 500 }
        );
      }
      scaleList = (scales || []).map((s: { id: string; name: string; numeric_value: number; display_order?: number }) => ({
        id: s.id,
        name: s.name,
        numeric_value: s.numeric_value,
        display_order: s.display_order ?? 0,
      }));
    }

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
