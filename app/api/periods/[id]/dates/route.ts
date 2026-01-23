import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get all dates for a period
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: dates, error } = await supabaseAdmin
      .from("period_dates")
      .select(
        `
        *,
        schedule:schedules(
          id,
          name,
          day_of_week,
          start_time,
          end_time
        )
      `
      )
      .eq("period_id", params.id)
      .is("deleted_at", null)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching period dates:", error);
      return NextResponse.json(
        { error: "Failed to fetch dates", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ dates: dates || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/periods/[id]/dates:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create one or multiple dates for a period
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only directors and super admins can create dates
    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify period exists and user has access
    const { data: period, error: periodError } = await supabaseAdmin
      .from("periods")
      .select("academy_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      period.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { dates } = body; // Array of date objects

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { error: "dates must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate and prepare dates for insertion
    const dateInserts = [];
    for (const dateItem of dates) {
      const { date_type, date, schedule_id, comment } = dateItem;

      // Validation
      if (!date_type || !["inicio", "cierre", "feriado", "recital", "clase", "otro"].includes(date_type)) {
        return NextResponse.json(
          { error: "Invalid date_type. Must be: inicio, cierre, feriado, recital, clase, or otro" },
          { status: 400 }
        );
      }

      if (!date || typeof date !== "string") {
        return NextResponse.json(
          { error: "date is required and must be a string (YYYY-MM-DD)" },
          { status: 400 }
        );
      }

      // If date_type is "clase", schedule_id is required
      if (date_type === "clase" && !schedule_id) {
        return NextResponse.json(
          { error: "schedule_id is required when date_type is 'clase'" },
          { status: 400 }
        );
      }

      // Validate schedule exists if provided
      if (schedule_id) {
        const { data: schedule, error: scheduleError } = await supabaseAdmin
          .from("schedules")
          .select("id, academy_id")
          .eq("id", schedule_id)
          .is("deleted_at", null)
          .single();

        if (scheduleError || !schedule) {
          return NextResponse.json(
            { error: `Schedule ${schedule_id} not found` },
            { status: 404 }
          );
        }

        // Verify schedule belongs to same academy
        if (schedule.academy_id !== period.academy_id) {
          return NextResponse.json(
            { error: "Schedule does not belong to the same academy" },
            { status: 403 }
          );
        }
      }

      if (comment && comment.length > 500) {
        return NextResponse.json(
          { error: "comment must be 500 characters or less" },
          { status: 400 }
        );
      }

      dateInserts.push({
        period_id: params.id,
        date_type,
        date,
        schedule_id: schedule_id || null,
        comment: comment || null,
      });
    }

    // Insert all dates
    const { data: insertedDates, error: insertError } = await supabaseAdmin
      .from("period_dates")
      .insert(dateInserts)
      .select();

    if (insertError) {
      console.error("Error creating period dates:", insertError);
      return NextResponse.json(
        { error: "Failed to create dates", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ dates: insertedDates }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/periods/[id]/dates:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
