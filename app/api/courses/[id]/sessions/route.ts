import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Sesiones (course_sessions) del curso
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

    if (
      profile.role !== "director" &&
      profile.role !== "super_admin" &&
      profile.role !== "professor"
    ) {
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

    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id, profile_id, academy_id")
      .eq("id", courseId)
      .is("deleted_at", null)
      .single();

    if (courseErr || !course) {
      return NextResponse.json(
        { error: "Curso no encontrado" },
        { status: 404 }
      );
    }

    if (profile.role === "professor") {
      if (course.profile_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (
      profile.role !== "super_admin" &&
      course.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: sessions, error } = await supabaseAdmin
      .from("course_sessions")
      .select("id, date")
      .eq("course_id", courseId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching sessions:", error);
      return NextResponse.json(
        { error: "Error al cargar sesiones", details: error.message },
        { status: 500 }
      );
    }

    const sessionsWithType = (sessions || []).map((s) => ({
      ...s,
      date_type: "clase",
      comment: null,
      profile_id: course.profile_id,
    }));

    return NextResponse.json({ sessions: sessionsWithType });
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
