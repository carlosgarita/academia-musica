import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get course registrations for students of a guardian (for contract creation)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guardianId: string }> }
) {
  try {
    const { guardianId } = await params;
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

    // Get guardian's students
    const { data: guardianStudents, error: gsError } = await supabaseAdmin
      .from("guardian_students")
      .select("student_id")
      .eq("guardian_id", guardianId);

    if (gsError || !guardianStudents || guardianStudents.length === 0) {
      return NextResponse.json({
        courseRegistrations: [],
      });
    }

    const studentIds = guardianStudents.map((gs: { student_id: string }) => gs.student_id);

    // Verify guardian belongs to academy
    const { data: guardianProfile } = await supabaseAdmin
      .from("profiles")
      .select("academy_id")
      .eq("id", guardianId)
      .eq("role", "guardian")
      .is("deleted_at", null)
      .single();

    if (!guardianProfile) {
      return NextResponse.json({
        courseRegistrations: [],
      });
    }

    const academyId = guardianProfile.academy_id;
    if (
      profile.role !== "super_admin" &&
      academyId !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get course registrations for these students
    const { data: registrations, error: regError } = await supabaseAdmin
      .from("course_registrations")
      .select(
        `
        id,
        student_id,
        subject_id,
        period_id,
        profile_id,
        status,
        student:students!inner(id, first_name, last_name, deleted_at),
        subject:subjects!inner(id, name, deleted_at),
        period:periods!inner(id, year, period, deleted_at)
      `
      )
      .in("student_id", studentIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (regError) {
      console.error("Error fetching course registrations:", regError);
      return NextResponse.json(
        { error: "Failed to fetch course registrations", details: regError.message },
        { status: 500 }
      );
    }

    // Filter soft-deleted student, subject, period (Supabase join can return single obj or array)
    const getDeletedAt = (v: unknown): string | null | undefined => {
      if (!v) return undefined;
      const obj = Array.isArray(v) ? v[0] : v;
      return (obj as { deleted_at?: string | null })?.deleted_at;
    };
    const filtered = (registrations || []).filter((r: { student?: unknown; subject?: unknown; period?: unknown }) =>
      !getDeletedAt(r.student) && !getDeletedAt(r.subject) && !getDeletedAt(r.period)
    );

    // Add first_session_date and last_session_date for each registration (from period_dates, date_type='clase')
    const periodIds = [...new Set(filtered.map((r: { period_id: string }) => r.period_id))];
    const { data: dates } = await supabaseAdmin
      .from("period_dates")
      .select("date, period_id, subject_id, profile_id")
      .in("period_id", periodIds)
      .eq("date_type", "clase")
      .is("deleted_at", null);

    const dateRanges: Record<string, { first: string; last: string }> = {};
    for (const reg of filtered) {
      // Match: period_id + subject_id (when set); profile_id optional
      let matchingDates = (dates || []).filter((d: { period_id: string; subject_id: string | null; profile_id: string | null }) => {
        if (d.period_id !== reg.period_id) return false;
        if (d.subject_id != null && d.subject_id !== reg.subject_id) return false;
        if (d.profile_id != null && reg.profile_id != null && d.profile_id !== reg.profile_id) return false;
        return true;
      });
      // Fallback: if no match, use period_id only (all clase dates for the period)
      if (matchingDates.length === 0) {
        matchingDates = (dates || []).filter((d: { period_id: string }) => d.period_id === reg.period_id);
      }
      const dateStrings = matchingDates.map((d: { date: string }) => d.date).sort();
      if (dateStrings.length > 0) {
        dateRanges[reg.id] = {
          first: dateStrings[0],
          last: dateStrings[dateStrings.length - 1],
        };
      }
    }

    const enriched = filtered.map((r: { id: string }) => {
      const range = dateRanges[r.id];
      return {
        ...r,
        first_session_date: range?.first ?? null,
        last_session_date: range?.last ?? null,
      };
    });

    return NextResponse.json({ courseRegistrations: enriched });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/contracts/guardians/[guardianId]/course-registrations:",
      error
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
