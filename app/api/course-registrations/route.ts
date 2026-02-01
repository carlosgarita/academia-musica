import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List course registrations for the user's academy
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
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");
    const periodId = searchParams.get("period_id");
    const subjectId = searchParams.get("subject_id");
    const courseId = searchParams.get("course_id");

    // Si course_id: resolver (profile_id, subject_id, period_id) para filtrar por curso
    let courseFilter: { profile_id: string; subject_id: string; period_id: string } | null = null;
    if (courseId) {
      const { data: psp, error: pspErr } = await supabaseAdmin
        .from("professor_subject_periods")
        .select("profile_id, subject_id, period_id")
        .eq("id", courseId)
        .single();
      if (pspErr || !psp) {
        return NextResponse.json({ courseRegistrations: [] });
      }
      if (profile.role === "professor" && psp.profile_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      courseFilter = { profile_id: psp.profile_id, subject_id: psp.subject_id, period_id: psp.period_id };
    }

    let query = supabaseAdmin
      .from("course_registrations")
      .select(
        `
        id,
        student_id,
        subject_id,
        period_id,
        profile_id,
        academy_id,
        status,
        enrollment_date,
        created_at,
        student:students!inner(id, first_name, last_name, deleted_at),
        subject:subjects!inner(id, name, deleted_at),
        period:periods!inner(id, year, period, deleted_at)
      `
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (profile.role !== "super_admin") {
      if (!profile.academy_id) {
        return NextResponse.json({ error: "Academy not found" }, { status: 404 });
      }
      query = query.eq("academy_id", profile.academy_id);
    }

    if (studentId) query = query.eq("student_id", studentId);
    if (periodId) query = query.eq("period_id", periodId);
    if (subjectId) query = query.eq("subject_id", subjectId);
    if (courseFilter) {
      query = query.eq("profile_id", courseFilter.profile_id).eq("subject_id", courseFilter.subject_id).eq("period_id", courseFilter.period_id);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error("Error fetching course_registrations:", error);
      return NextResponse.json({ error: "Failed to fetch course registrations", details: error.message }, { status: 500 });
    }

    // Filter soft-deleted student, subject, period on client
    const filtered = (rows || []).filter(
      (r: any) =>
        !r.student?.deleted_at &&
        !r.subject?.deleted_at &&
        !r.period?.deleted_at
    );

    // Get song counts
    const ids = filtered.map((r: any) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: songs } = await supabaseAdmin
        .from("course_registration_songs")
        .select("course_registration_id")
        .in("course_registration_id", ids);
      counts = (songs || []).reduce((acc: Record<string, number>, s: any) => {
        acc[s.course_registration_id] = (acc[s.course_registration_id] || 0) + 1;
        return acc;
      }, {});
    }

    const courseRegistrations = filtered.map((r: any) => ({
      id: r.id,
      student_id: r.student_id,
      subject_id: r.subject_id,
      period_id: r.period_id,
      profile_id: r.profile_id ?? null,
      academy_id: r.academy_id,
      status: r.status,
      enrollment_date: r.enrollment_date,
      created_at: r.created_at,
      student: r.student ? { id: r.student.id, first_name: r.student.first_name, last_name: r.student.last_name } : null,
      subject: r.subject ? { id: r.subject.id, name: r.subject.name } : null,
      period: r.period ? { id: r.period.id, year: r.period.year, period: r.period.period } : null,
      songs_count: counts[r.id] || 0,
    }));

    return NextResponse.json({ courseRegistrations });
  } catch (error) {
    console.error("Unexpected error in GET /api/course-registrations:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: Create a course registration
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
      return NextResponse.json({ error: "Academy not found" }, { status: 404 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await request.json();
    const { student_id, subject_id, period_id, profile_id, song_ids } = body;

    if (!student_id || !subject_id || !period_id) {
      return NextResponse.json(
        { error: "student_id, subject_id and period_id are required" },
        { status: 400 }
      );
    }
    if (!profile_id) {
      return NextResponse.json(
        { error: "profile_id (profesor del curso) es obligatorio" },
        { status: 400 }
      );
    }

    // Validate student: exists, not deleted, same academy (for director), active
    const { data: student, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("id, academy_id, deleted_at, enrollment_status")
      .eq("id", student_id)
      .single();

    if (studentErr || !student || student.deleted_at) {
      return NextResponse.json({ error: "Student not found or inactive" }, { status: 404 });
    }
    if (profile.role !== "super_admin" && student.academy_id !== academyId) {
      return NextResponse.json({ error: "Student does not belong to this academy" }, { status: 400 });
    }
    if (student.enrollment_status === "retirado") {
      return NextResponse.json({ error: "Student is withdrawn" }, { status: 400 });
    }

    const academy = student.academy_id;

    // Validate subject: exists, not deleted, same academy
    const { data: subject, error: subjErr } = await supabaseAdmin
      .from("subjects")
      .select("id, academy_id, deleted_at")
      .eq("id", subject_id)
      .single();

    if (subjErr || !subject || subject.deleted_at) {
      return NextResponse.json({ error: "Materia (clase) no encontrada" }, { status: 404 });
    }
    if (subject.academy_id !== academy) {
      return NextResponse.json({ error: "La materia no pertenece a esta academia" }, { status: 400 });
    }

    // Validate period: exists, not deleted, same academy
    const { data: period, error: periodErr } = await supabaseAdmin
      .from("periods")
      .select("id, academy_id, deleted_at")
      .eq("id", period_id)
      .single();

    if (periodErr || !period || period.deleted_at) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }
    if (period.academy_id !== academy) {
      return NextResponse.json({ error: "Period does not belong to this academy" }, { status: 400 });
    }

    // Validar que el curso (profile_id, subject_id, period_id) existe en professor_subject_periods
    const { data: psp, error: pspErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("id")
      .eq("profile_id", profile_id)
      .eq("subject_id", subject_id)
      .eq("period_id", period_id)
      .single();

    if (pspErr || !psp) {
      return NextResponse.json({ error: "El curso (profesor, materia, periodo) no existe" }, { status: 400 });
    }

    // Unique(student_id, subject_id, period_id, profile_id)
    const { data: existing } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .eq("student_id", student_id)
      .eq("subject_id", subject_id)
      .eq("period_id", period_id)
      .eq("profile_id", profile_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Este estudiante ya está matriculado en este curso" }, { status: 400 });
    }

    const { data: reg, error: insertErr } = await supabaseAdmin
      .from("course_registrations")
      .insert({
        student_id,
        subject_id,
        period_id,
        profile_id,
        academy_id: academy,
      })
      .select()
      .single();

    if (insertErr) {
      const err = insertErr as { code?: string; message?: string };
      console.error("Error creating course_registration:", err);
      // Unique violation: (student_id, subject_id, period_id) — incl. si hubo matrícula anterior dada de baja
      if (err.code === "23505") {
        return NextResponse.json(
          { error: "Este estudiante ya está matriculado en este curso." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Error al crear la matrícula", details: err.message || "Failed to create course registration" },
        { status: 500 }
      );
    }

    const songIds = Array.isArray(song_ids) ? song_ids : [];
    if (songIds.length > 0) {
      // Validate songs: same academy, not deleted
      const { data: songs } = await supabaseAdmin
        .from("songs")
        .select("id, academy_id, deleted_at")
        .in("id", songIds)
        .is("deleted_at", null);

      const valid = (songs || []).filter((s: any) => s.academy_id === academy).map((s: any) => s.id);
      const toInsert = valid.map((sid: string) => ({ course_registration_id: reg.id, song_id: sid }));

      if (toInsert.length > 0) {
        await supabaseAdmin.from("course_registration_songs").insert(toInsert);
      }
    }

    return NextResponse.json({ courseRegistration: reg }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/course-registrations:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
