import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Helper: Verify guardian has access to a student
async function guardianCanAccessStudent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  guardianId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("guardian_students")
    .select("id")
    .eq("guardian_id", guardianId)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

// GET: Get courses (course_registrations) for a student
// Returns current courses and historical courses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;

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

    if (!profile) {
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

    // Verify access based on role
    if (profile.role === "guardian") {
      const canAccess = await guardianCanAccessStudent(
        supabaseAdmin,
        user.id,
        studentId
      );
      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "director") {
      // Verify student belongs to director's academy
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("academy_id")
        .eq("id", studentId)
        .maybeSingle();
      if (!student || student.academy_id !== profile.academy_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all course registrations for the student
    const { data: registrations, error: fetchError } = await supabaseAdmin
      .from("course_registrations")
      .select(
        `
        id,
        student_id,
        subject_id,
        period_id,
        academy_id,
        status,
        enrollment_date,
        created_at,
        profile_id,
        subject:subjects(
          id,
          name,
          description
        ),
        period:periods(
          id,
          year,
          period,
          academy_id
        ),
        profile:profiles(
          id,
          first_name,
          last_name
        )
      `
      )
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching course registrations:", fetchError);
      return NextResponse.json(
        { error: "Error al cargar cursos", details: fetchError.message },
        { status: 500 }
      );
    }

    // Determine current year to separate current vs historical
    const currentYear = new Date().getFullYear();

    // Helper: Supabase relations can return arrays, unwrap to single object
    const unwrap = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] as T) ?? null : v ?? null;

    // Format and separate courses
    const courses = (registrations || []).map((r: Record<string, unknown>) => {
      const subj = unwrap(r.subject as { id: string; name: string; description?: string | null } | { id: string; name: string; description?: string | null }[] | null);
      const per = unwrap(r.period as { id: string; year: number; period: string } | { id: string; year: number; period: string }[] | null);
      const prof = unwrap(r.profile as { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null);
      return {
        id: r.id,
        student_id: r.student_id,
        subject_id: r.subject_id,
        period_id: r.period_id,
        academy_id: r.academy_id,
        status: r.status,
        enrollment_date: r.enrollment_date,
        subject: subj ? { id: subj.id, name: subj.name, description: subj.description } : null,
        period: per ? { id: per.id, year: per.year, period: per.period } : null,
        profile: prof ? { id: prof.id, first_name: prof.first_name, last_name: prof.last_name } : null,
        isCurrent: per ? per.year === currentYear : false,
      };
    });

    const currentCourses = courses.filter((c: { isCurrent: boolean }) => c.isCurrent);
    const historicalCourses = courses.filter((c: { isCurrent: boolean }) => !c.isCurrent);

    return NextResponse.json({
      currentCourses,
      historicalCourses,
      allCourses: courses,
    });
  } catch (e) {
    console.error("GET /api/guardian/students/[studentId]/courses:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
