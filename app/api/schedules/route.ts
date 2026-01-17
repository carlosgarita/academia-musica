import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List all schedules for the director's academy
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

    // Build query - get basic schedule data first
    // For directors, we might need to use service role to bypass RLS if policies aren't set up correctly
    let schedules;
    let error;

    // First try with regular client
    if (profile.role === "super_admin") {
      // Super admin can see all
      const result = await supabase
        .from("schedules")
        .select("*")
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      schedules = result.data;
      error = result.error;
    } else {
      // Director - filter by academy_id
      const result = await supabase
        .from("schedules")
        .select("*")
        .eq("academy_id", academyId)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      schedules = result.data;
      error = result.error;

      // If error and it's likely an RLS issue, try with service role
      if (error && (error.code === "42501" || error.message?.includes("policy") || error.message?.includes("permission"))) {
        console.log("RLS error detected, trying with service role...");
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
          const adminResult = await supabaseAdmin
            .from("schedules")
            .select("*")
            .eq("academy_id", academyId)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });
          schedules = adminResult.data;
          error = adminResult.error;
        }
      }
    }

    if (error) {
      console.error("Error fetching schedules:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      console.error("User ID:", user.id);
      console.error("Profile:", profile);
      console.error("Academy ID:", academyId);
      return NextResponse.json(
        { 
          error: "Failed to fetch schedules", 
          details: error.message,
          hint: error.hint || null,
          code: error.code || null,
          debug: {
            user_id: user.id,
            profile_role: profile.role,
            academy_id: academyId
          }
        },
        { status: 500 }
      );
    }

    // Now fetch profile data for each schedule
    const schedulesWithProfiles = await Promise.all(
      (schedules || []).map(async (schedule) => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("id", schedule.profile_id)
          .single();

        return {
          ...schedule,
          profile: profileData || null,
        };
      })
    );

    return NextResponse.json({ schedules: schedulesWithProfiles });
  } catch (error) {
    console.error("Unexpected error in GET /api/schedules:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new schedule (can create multiple for multiple days)
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

    // Get user profile
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

    const body = await request.json();
    const {
      name,
      profile_id, // Changed from professor_id to profile_id
      time_slots, // array of { day_of_week, start_time, end_time }
      // Legacy support: days_of_week, start_time, end_time
      days_of_week,
      start_time,
      end_time,
    } = body;

    // Validation
    if (!name || !profile_id) {
      return NextResponse.json(
        { error: "Missing required fields: name and profile_id are required" },
        { status: 400 }
      );
    }

    // Support both new format (time_slots) and legacy format (days_of_week)
    let slots: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];

    if (time_slots) {
      // New format: array of time slots
      if (!Array.isArray(time_slots) || time_slots.length === 0) {
        return NextResponse.json(
          { error: "time_slots must be a non-empty array" },
          { status: 400 }
        );
      }

      // Validate each slot
      for (const slot of time_slots) {
        if (
          !slot.day_of_week ||
          !slot.start_time ||
          !slot.end_time ||
          typeof slot.day_of_week !== "number" ||
          slot.day_of_week < 1 ||
          slot.day_of_week > 7
        ) {
          return NextResponse.json(
            {
              error: "Invalid time slot format. Each slot must have day_of_week (1-7), start_time, and end_time",
            },
            { status: 400 }
          );
        }

        const start = new Date(`2000-01-01T${slot.start_time}`);
        const end = new Date(`2000-01-01T${slot.end_time}`);
        if (end <= start) {
          return NextResponse.json(
            { error: `end_time must be after start_time for slot on day ${slot.day_of_week}` },
            { status: 400 }
          );
        }

        slots.push({
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
      }
    } else if (days_of_week && start_time && end_time) {
      // Legacy format: single time range for multiple days
      if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
        return NextResponse.json(
          { error: "days_of_week must be a non-empty array" },
          { status: 400 }
        );
      }

      // Validate time range
      const start = new Date(`2000-01-01T${start_time}`);
      const end = new Date(`2000-01-01T${end_time}`);
      if (end <= start) {
        return NextResponse.json(
          { error: "end_time must be after start_time" },
          { status: 400 }
        );
      }

      // Convert to time_slots format
      slots = days_of_week.map((day: number) => ({
        day_of_week: day,
        start_time,
        end_time,
      }));
    } else {
      return NextResponse.json(
        { error: "Must provide either time_slots array or days_of_week with start_time and end_time" },
        { status: 400 }
      );
    }

    // Check for conflicts before creating
    const createdSchedules = [];
    const errors = [];

    for (const slot of slots) {
      const { day_of_week, start_time: slotStartTime, end_time: slotEndTime } = slot;
      // Check conflicts using RPC function (now uses profile_id instead of professor_id)
      const { data: conflicts, error: conflictError } = await supabase.rpc(
        "check_schedule_conflicts",
        {
          p_academy_id: academyId,
          p_day_of_week: day_of_week,
          p_start_time: slotStartTime,
          p_end_time: slotEndTime,
          p_schedule_id: null, // new schedule
        }
      );

      if (conflictError) {
        console.error("Error checking conflicts:", conflictError);
        errors.push(`Error checking conflicts for day ${day_of_week}`);
        continue;
      }

      if (conflicts && conflicts.length > 0) {
        const conflict = conflicts[0];
        errors.push(
          `${conflict.conflict_message}: ${conflict.conflicting_schedule_name} (Día ${day_of_week})`
        );
        continue;
      }

      // Verify the profile_id is a professor in the same academy
      const { data: professorProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, academy_id")
        .eq("id", profile_id)
        .eq("role", "professor")
        .single();

      if (profileError || !professorProfile) {
        errors.push(`Invalid professor profile for day ${day_of_week}`);
        continue;
      }

      if (professorProfile.academy_id !== academyId) {
        errors.push(`Professor does not belong to this academy (day ${day_of_week})`);
        continue;
      }

      // Check for conflicts: verify no other schedule for this professor at this time
      const { data: existingSchedule } = await supabase
        .from("schedules")
        .select("id")
        .eq("academy_id", academyId)
        .eq("profile_id", profile_id)
        .eq("day_of_week", day_of_week)
        .or(
          `and(start_time.lte.${slotStartTime},end_time.gt.${slotStartTime}),and(start_time.lt.${slotEndTime},end_time.gte.${slotEndTime}),and(start_time.gte.${slotStartTime},end_time.lte.${slotEndTime})`
        )
        .single();

      if (existingSchedule) {
        errors.push(`Schedule conflict for professor on day ${day_of_week} (${slotStartTime} - ${slotEndTime})`);
        continue;
      }

      // Create schedule for this day
      const { data: schedule, error: createError } = await supabase
        .from("schedules")
        .insert({
          academy_id: academyId,
          name,
          profile_id,
          day_of_week: day_of_week,
          start_time: slotStartTime,
          end_time: slotEndTime,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating schedule:", createError);
        errors.push(`Error creating schedule for day ${day_of_week}`);
        continue;
      }

      createdSchedules.push(schedule);
    }

    if (errors.length > 0 && createdSchedules.length === 0) {
      return NextResponse.json(
        { error: "Failed to create schedules", details: errors },
        { status: 400 }
      );
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          schedules: createdSchedules,
          warnings: errors,
          message: "Some schedules were created, but some had conflicts",
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json(
      {
        schedules: createdSchedules,
        message: "Schedules created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/schedules:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
