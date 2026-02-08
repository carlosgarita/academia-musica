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

    // Get course registrations with course_id
    const { data: regs, error: regError } = await supabaseAdmin
      .from("course_registrations")
      .select("id, course_id")
      .in("id", course_registration_ids)
      .not("course_id", "is", null)
      .is("deleted_at", null);

    if (regError || !regs || regs.length === 0) {
      return NextResponse.json(
        { start_date: null, end_date: null },
      );
    }

    const courseIds = [...new Set(regs.map((r: { course_id: string }) => r.course_id))];

    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from("course_sessions")
      .select("date")
      .in("course_id", courseIds)
      .order("date", { ascending: true });

    if (sessionsError || !sessions || sessions.length === 0) {
      return NextResponse.json(
        { start_date: null, end_date: null },
      );
    }

    const dateStrings = sessions.map((s: { date: string }) => s.date).sort();
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
