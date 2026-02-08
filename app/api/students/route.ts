import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Obtiene los student_ids matriculados en cursos del profesor, opcionalmente filtrados por curso o por períodos activos */
async function getStudentIdsForProfessor(
  academyId: string,
  professorId: string,
  courseId: string | null,
  activeOnly: boolean,
  createClientFn: typeof createClient
): Promise<string[]> {
  const supabaseAdmin = createClientFn(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let profileId = professorId;
  let subjectId: string | null = null;
  let periodId: string | null = null;
  let allowedPeriodIds: string[] | null = null;

  if (courseId) {
    const { data: psp, error } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("profile_id, subject_id, period_id")
      .eq("id", courseId)
      .single();

    if (error || !psp || psp.profile_id !== professorId) {
      return [];
    }
    profileId = psp.profile_id;
    subjectId = psp.subject_id;
    periodId = psp.period_id;
  } else if (activeOnly) {
    const currentYear = new Date().getFullYear();
    const { data: periods } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("academy_id", academyId)
      .gte("year", currentYear - 1)
      .is("deleted_at", null);
    allowedPeriodIds = (periods || []).map((p: { id: string }) => p.id);
    if (allowedPeriodIds.length === 0) return [];
  }

  let crQuery = supabaseAdmin
    .from("course_registrations")
    .select("student_id")
    .eq("academy_id", academyId)
    .eq("profile_id", profileId)
    .is("deleted_at", null);

  if (subjectId) crQuery = crQuery.eq("subject_id", subjectId);
  if (periodId) crQuery = crQuery.eq("period_id", periodId);
  if (allowedPeriodIds && allowedPeriodIds.length > 0) {
    crQuery = crQuery.in("period_id", allowedPeriodIds);
  }

  const { data: rows } = await crQuery;
  const ids = [...new Set((rows || []).map((r: { student_id: string }) => r.student_id))];
  return ids;
}

// GET: List all students for the director's academy (with guardian info from guardian_students)
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

    // Get user profile to check role and academy
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
      profile.role !== "professor" &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const professorIdParam = searchParams.get("professor_id");
    const courseIdParam = searchParams.get("course_id");

    // Profesores: solo ven estudiantes matriculados en sus cursos
    // Directores: pueden filtrar por profesor_id/course_id (Aula/Estudiantes)
    let allowedStudentIds: string[] | null = null;
    if (profile.role === "professor") {
      const effProfessorId = professorIdParam ?? user.id;
      if (effProfessorId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const ids = await getStudentIdsForProfessor(
        profile.academy_id!,
        effProfessorId,
        courseIdParam,
        !courseIdParam,
        createClient
      );
      allowedStudentIds = ids;
      if (ids.length === 0) {
        return NextResponse.json({ students: [] });
      }
    } else if (profile.role === "director" && professorIdParam) {
      const supabaseAdminForCheck = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: prof } = await supabaseAdminForCheck
        .from("profiles")
        .select("academy_id")
        .eq("id", professorIdParam)
        .eq("role", "professor")
        .single();
      if (!prof || prof.academy_id !== profile.academy_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const ids = await getStudentIdsForProfessor(
        profile.academy_id!,
        professorIdParam,
        courseIdParam,
        !courseIdParam,
        createClient
      );
      allowedStudentIds = ids;
      if (ids.length === 0) {
        return NextResponse.json({ students: [] });
      }
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

    // 1) Fetch students
    let studentsQuery = supabaseAdmin
      .from("students")
      .select("*")
      .is("deleted_at", null)
      .order("first_name", { ascending: true })
      .order("last_name", { ascending: true });

    if (profile.role !== "super_admin" && academyId) {
      studentsQuery = studentsQuery.eq("academy_id", academyId);
    }
    if (allowedStudentIds !== null) {
      studentsQuery = studentsQuery.in("id", allowedStudentIds);
    }

    const { data: students, error } = await studentsQuery;

    if (error) {
      console.error("Error fetching students:", error);
      return NextResponse.json(
        { error: "Failed to fetch students", details: error.message },
        { status: 500 }
      );
    }

    const studentsList = students || [];
    if (studentsList.length === 0) {
      return NextResponse.json({ students: [] });
    }

    const studentIds = studentsList.map((s: { id: string }) => s.id);

    // 2) Fetch guardian_students (student_id, guardian_id)
    const { data: guardianAssignments } = await supabaseAdmin
      .from("guardian_students")
      .select("student_id, guardian_id")
      .in("student_id", studentIds);

    const guardianByStudentId: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};

    if (guardianAssignments && guardianAssignments.length > 0) {
      const guardianIds = [...new Set(guardianAssignments.map((gs: { guardian_id: string }) => gs.guardian_id))];

      // 3) Fetch guardian profiles
      const { data: guardians } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", guardianIds);

      const guardianMap: Record<string, { first_name: string | null; last_name: string | null; email: string }> = {};
      for (const g of guardians || []) {
        guardianMap[g.id] = {
          first_name: g.first_name,
          last_name: g.last_name,
          email: g.email,
        };
      }

      for (const gs of guardianAssignments) {
        const guardian = guardianMap[gs.guardian_id];
        if (guardian) {
          guardianByStudentId[gs.student_id] = guardian;
        }
      }
    }

    // 4) Merge guardian into each student
    const studentsWithGuardian = studentsList.map((s: { id: string }) => ({
      ...s,
      guardian: guardianByStudentId[s.id] || null,
    }));

    return NextResponse.json({ students: studentsWithGuardian });
  } catch (error) {
    console.error("Unexpected error in GET /api/students:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
