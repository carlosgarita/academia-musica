import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// POST: Compute start_date and end_date from period_dates (clase) for given course_registration_ids
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
    const { course_registration_ids } = body;

    if (!Array.isArray(course_registration_ids) || course_registration_ids.length === 0) {
      return NextResponse.json(
        { start_date: null, end_date: null },
      );
    }

    // Get course registrations with period_id, subject_id, profile_id
    const { data: regs, error: regError } = await supabaseAdmin
      .from("course_registrations")
      .select("id, period_id, subject_id, profile_id")
      .in("id", course_registration_ids)
      .is("deleted_at", null);

    if (regError || !regs || regs.length === 0) {
      return NextResponse.json(
        { start_date: null, end_date: null },
      );
    }

    // Collect period_ids for those registrations
    const periodIds = [...new Set(regs.map((r: { period_id: string }) => r.period_id))];

    // Fetch period_dates with date_type='clase' for those periods
    const { data: dates, error: datesError } = await supabaseAdmin
      .from("period_dates")
      .select("date, subject_id, profile_id, period_id")
      .in("period_id", periodIds)
      .eq("date_type", "clase")
      .is("deleted_at", null);

    if (datesError || !dates || dates.length === 0) {
      return NextResponse.json(
        { start_date: null, end_date: null },
      );
    }

    // Filter dates: keep those that match at least one registration
    let matchingDates = dates.filter(
      (d: { period_id: string; subject_id: string | null; profile_id: string | null }) =>
        regs.some((r: { period_id: string; subject_id: string; profile_id: string | null }) => {
          if (d.period_id !== r.period_id) return false;
          if (d.subject_id != null && d.subject_id !== r.subject_id) return false;
          if (d.profile_id != null && r.profile_id != null && d.profile_id !== r.profile_id) return false;
          return true;
        })
    );
    // Fallback: match by period_id only
    if (matchingDates.length === 0) {
      matchingDates = dates.filter((d: { period_id: string }) =>
        regs.some((r: { period_id: string }) => r.period_id === d.period_id)
      );
    }

    if (matchingDates.length === 0) {
      return NextResponse.json(
        { start_date: null, end_date: null },
      );
    }

    const dateStrings = matchingDates.map((d: { date: string }) => d.date).sort();
    const start_date = dateStrings[0];
    const end_date = dateStrings[dateStrings.length - 1];

    return NextResponse.json({ start_date, end_date });
  } catch (error) {
    console.error("Unexpected error in POST /api/contracts/date-range:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
