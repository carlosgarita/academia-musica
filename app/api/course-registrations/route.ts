import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List course registrations for the user's academy
// Supports course_id filter
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");
    const courseIdParam = searchParams.get("course_id");

    let query = supabaseAdmin
      .from("course_registrations")
      .select(
        `
        id,
        student_id,
        course_id,
        profile_id,
        academy_id,
        status,
        enrollment_date,
        created_at,
        student:students!inner(id, first_name, last_name, deleted_at),
        course:courses(id, name, year, deleted_at)
      `
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (profile.role !== "super_admin") {
      if (!profile.academy_id) {
        return NextResponse.json(
          { error: "Academy not found" },
          { status: 404 }
        );
      }
      query = query.eq("academy_id", profile.academy_id);
    }

    if (studentId) query = query.eq("student_id", studentId);
    if (courseIdParam) query = query.eq("course_id", courseIdParam);

    const { data: rows, error } = await query;

    if (error) {
      console.error("Error fetching course_registrations:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch course registrations",
          details: error.message,
        },
        { status: 500 }
      );
    }

    // Filter soft-deleted student; for subject/period/course, allow null (legacy or new)
    const filtered = (rows || []).filter((r: { student?: { deleted_at?: string | null } }) => !r.student?.deleted_at);

    const ids = filtered.map((r: { id: string }) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: songs } = await supabaseAdmin
        .from("course_registration_songs")
        .select("course_registration_id")
        .in("course_registration_id", ids);
      counts = (songs || []).reduce(
        (acc: Record<string, number>,
          s: { course_registration_id: string }) => {
          acc[s.course_registration_id] =
            (acc[s.course_registration_id] || 0) + 1;
          return acc;
        },
        {}
      );
    }

    const courseRegistrations = filtered.map((r: {
      id: string;
      student_id: string;
      course_id?: string | null;
      profile_id?: string | null;
      academy_id: string;
      status: string;
      enrollment_date: string;
      created_at: string;
      student?: { id: string; first_name: string; last_name: string } | null;
      course?: { id: string; name: string; year: number } | null;
    }) => ({
      id: r.id,
      student_id: r.student_id,
      course_id: r.course_id ?? null,
      profile_id: r.profile_id ?? null,
      academy_id: r.academy_id,
      status: r.status,
      enrollment_date: r.enrollment_date,
      created_at: r.created_at,
      student: r.student
        ? {
            id: r.student.id,
            first_name: r.student.first_name,
            last_name: r.student.last_name,
          }
        : null,
      course: r.course && !r.course.deleted_at ? r.course : null,
      songs_count: counts[r.id] || 0,
    }));

    return NextResponse.json({ courseRegistrations });
  } catch (error) {
    console.error("Unexpected error in GET /api/course-registrations:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a course registration
// Body: { student_id, course_id, song_ids? } - course_id references courses table
export async function POST(request: NextRequest) {
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

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
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

    const body = await request.json();
    const { student_id, course_id, song_ids } = body;

    if (!student_id || !course_id) {
      return NextResponse.json(
        { error: "student_id y course_id son obligatorios" },
        { status: 400 }
      );
    }

    // Validate student
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("id, academy_id, deleted_at, enrollment_status")
      .eq("id", student_id)
      .single();

    if (studentErr || !student || student.deleted_at) {
      return NextResponse.json(
        { error: "Estudiante no encontrado o inactivo" },
        { status: 404 }
      );
    }
    if (profile.role !== "super_admin" && student.academy_id !== academyId) {
      return NextResponse.json(
        { error: "El estudiante no pertenece a esta academia" },
        { status: 400 }
      );
    }
    if (student.enrollment_status === "retirado") {
      return NextResponse.json(
        { error: "El estudiante está retirado" },
        { status: 400 }
      );
    }

    const academy = student.academy_id;

    // Validate course (from courses table)
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id, academy_id, profile_id, deleted_at")
      .eq("id", course_id)
      .is("deleted_at", null)
      .single();

    if (courseErr || !course) {
      return NextResponse.json(
        { error: "Curso no encontrado" },
        { status: 404 }
      );
    }
    if (course.academy_id !== academy) {
      return NextResponse.json(
        { error: "El curso no pertenece a esta academia" },
        { status: 400 }
      );
    }

    // Check duplicate
    const { data: existing } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .eq("student_id", student_id)
      .eq("course_id", course_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: "Este estudiante ya está matriculado en este curso",
        },
        { status: 400 }
      );
    }

    const { data: reg, error: insertErr } = await supabaseAdmin
      .from("course_registrations")
      .insert({
        student_id,
        course_id: course.id,
        profile_id: course.profile_id,
        academy_id: academy,
      })
      .select()
      .single();

    if (insertErr) {
      const err = insertErr as { code?: string; message?: string };
      console.error("Error creating course_registration:", err);
      if (err.code === "23505") {
        return NextResponse.json(
          {
            error: "Este estudiante ya está matriculado en este curso.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: "Error al crear la matrícula",
          details: err.message || "Failed to create course registration",
        },
        { status: 500 }
      );
    }

    const songIds = Array.isArray(song_ids) ? song_ids : [];
    if (songIds.length > 0) {
      const { data: songs } = await supabaseAdmin
        .from("songs")
        .select("id, academy_id, deleted_at")
        .in("id", songIds)
        .is("deleted_at", null);

      const valid = (songs || []).filter(
        (s: { academy_id: string }) => s.academy_id === academy
      );
      const toInsert = valid.map((s: { id: string }) => ({
        course_registration_id: reg.id,
        song_id: s.id,
      }));

      if (toInsert.length > 0) {
        await supabaseAdmin
          .from("course_registration_songs")
          .insert(toInsert);
      }
    }

    return NextResponse.json({ courseRegistration: reg }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/course-registrations:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
