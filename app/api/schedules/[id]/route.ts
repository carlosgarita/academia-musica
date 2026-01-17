import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// GET: Get a single schedule by ID
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

    const { data: schedule, error } = await supabase
      .from("schedules")
      .select(
        `
        *,
        profile:profiles!schedules_profile_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `
      )
      .eq("id", params.id)
      .single();

    if (error) {
      console.error("Error fetching schedule:", error);
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error("Unexpected error in GET /api/schedules/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH: Update a schedule
export async function PATCH(
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

    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get current schedule to check academy
    const { data: currentSchedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("academy_id")
      .eq("id", params.id)
      .single();

    if (scheduleError || !currentSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      currentSchedule.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, profile_id, day_of_week, start_time, end_time } = body;

    // Get current schedule
    const { data: existingSchedule, error: scheduleFetchError } = await supabase
      .from("schedules")
      .select("*")
      .eq("id", params.id)
      .single();

    if (scheduleFetchError || !existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Verify academy access
    const { data: currentSchedule } = await supabase
      .from("schedules")
      .select("academy_id")
      .eq("id", params.id)
      .single();

    if (
      profile.role !== "super_admin" &&
      currentSchedule?.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use provided values or existing ones
    const finalProfileId = profile_id || existingSchedule.profile_id;
    const finalDayOfWeek = day_of_week || existingSchedule.day_of_week;
    const finalStartTime = start_time || existingSchedule.start_time;
    const finalEndTime = end_time || existingSchedule.end_time;

    // Check for conflicts (excluding current schedule)
    const { data: conflicts, error: conflictError } = await supabase.rpc(
      "check_schedule_conflicts",
      {
        p_academy_id: existingSchedule.academy_id,
        p_day_of_week: finalDayOfWeek,
        p_start_time: finalStartTime,
        p_end_time: finalEndTime,
        p_academy_id: currentSchedule.academy_id,
        p_schedule_id: params.id, // exclude this schedule
      }
    );

    if (conflictError) {
      console.error("Error checking conflicts:", conflictError);
      return NextResponse.json(
        { error: "Error checking conflicts", details: conflictError.message },
        { status: 500 }
      );
    }

    if (conflicts && conflicts.length > 0) {
      const conflict = conflicts[0];
      return NextResponse.json(
        {
          error: "Schedule conflict detected",
          details: `${conflict.conflict_message}: ${conflict.conflicting_schedule_name}`,
        },
        { status: 400 }
      );
    }

    // Update schedule
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (profile_id !== undefined) {
      // Verify the profile_id is a professor in the same academy
      const { data: professorProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, academy_id")
        .eq("id", profile_id)
        .eq("role", "professor")
        .single();

      if (profileError || !professorProfile) {
        return NextResponse.json(
          { error: "Invalid professor profile" },
          { status: 400 }
        );
      }

      if (professorProfile.academy_id !== existingSchedule.academy_id) {
        return NextResponse.json(
          { error: "Professor does not belong to this academy" },
          { status: 400 }
        );
      }

      updateData.profile_id = profile_id;
    }
    if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;

    const { data: updatedSchedule, error: updateError } = await supabase
      .from("schedules")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating schedule:", updateError);
      return NextResponse.json(
        { error: "Failed to update schedule", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule: updatedSchedule });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/schedules/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a schedule
export async function DELETE(
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

    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get current schedule to check academy
    const { data: currentSchedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("academy_id")
      .eq("id", params.id)
      .single();

    if (scheduleError || !currentSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      currentSchedule.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from("schedules")
      .delete()
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error deleting schedule:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete schedule", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/schedules/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
