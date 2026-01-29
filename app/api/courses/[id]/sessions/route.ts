import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Sesiones (period_dates tipo clase) del curso
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: psp, error: pspErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("id, profile_id, subject_id, period_id, period:periods(academy_id)")
      .eq("id", courseId)
      .single();

    if (pspErr || !psp) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const period = psp.period as { academy_id?: string } | null;
    if (
      profile.role !== "super_admin" &&
      period?.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Sesiones del curso: period_dates tipo clase (mismo period_id + subject_id; opcional profile_id)
    const { data: allSessions, error } = await supabaseAdmin
      .from("period_dates")
      .select("id, date, date_type, comment, profile_id")
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id)
      .eq("date_type", "clase")
      .is("deleted_at", null)
      .order("date", { ascending: true });

    const sessions =
      allSessions?.filter(
        (s) => !s.profile_id || s.profile_id === psp.profile_id
      ) ?? [];

    if (error) {
      console.error("Error fetching sessions:", error);
      return NextResponse.json(
        { error: "Error al cargar sesiones", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions: sessions || [] });
  } catch (e) {
    console.error("GET /api/courses/[id]/sessions:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
