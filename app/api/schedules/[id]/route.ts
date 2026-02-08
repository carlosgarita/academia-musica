import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single schedule by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: schedule, error } = await supabaseAdmin
      .from("schedules")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching schedule:", error);
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Verify academy access
    if (
      profile.role !== "super_admin" &&
      schedule.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch profile data separately (exclude soft deleted)
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", schedule.profile_id)
      .is("deleted_at", null)
      .single();

    // Format professor name
    const professorName = profileData
      ? `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim() || "Sin nombre"
      : "Sin nombre";

    return NextResponse.json({
      schedule: {
        ...schedule,
        profile: profileData || null,
        professor: {
          name: professorName,
        },
      },
    });
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const body = await request.json();
    const { course_id, name, profile_id, day_of_week, start_time, end_time } = body;

    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { createClient } = await import("@supabase/supabase-js");
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

    // Get current schedule (exclude soft deleted)
    const { data: existingSchedule, error: scheduleFetchError } = await supabaseAdmin
      .from("schedules")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (scheduleFetchError || !existingSchedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Verify academy access
    if (
      profile.role !== "super_admin" &&
      existingSchedule.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Resolve course_id, name, and profile_id if course_id is provided
    let resolvedCourseId: string | null = existingSchedule.course_id || null;
    let resolvedName: string = existingSchedule.name;
    let resolvedProfileId: string | null = existingSchedule.profile_id || null;

    if (course_id) {
      const { data: course, error: courseError } = await supabaseAdmin
        .from("courses")
        .select("id, name, academy_id, profile_id")
        .eq("id", course_id)
        .is("deleted_at", null)
        .single();

      if (courseError || !course) {
        return NextResponse.json(
          { error: "Curso no encontrado" },
          { status: 400 }
        );
      }
      if (course.academy_id !== existingSchedule.academy_id) {
        return NextResponse.json(
          { error: "El curso no pertenece a esta academia" },
          { status: 400 }
        );
      }
      resolvedCourseId = course.id;
      resolvedName = course.name;
      resolvedProfileId = course.profile_id;
    } else if (name && typeof name === "string" && name.trim()) {
      resolvedName = name.trim();
    }

    // Use provided values or existing ones (profile from course takes precedence if course_id was provided)
    const finalProfileId = profile_id || resolvedProfileId || existingSchedule.profile_id;
    const finalDayOfWeek = day_of_week || existingSchedule.day_of_week;
    const finalStartTime = start_time || existingSchedule.start_time;
    const finalEndTime = end_time || existingSchedule.end_time;

    // Check for conflicts (excluding current schedule and soft deleted)
    const { data: conflictingSchedules, error: conflictError } = await supabaseAdmin
      .from("schedules")
      .select("id, name")
      .eq("academy_id", existingSchedule.academy_id)
      .eq("profile_id", finalProfileId)
      .eq("day_of_week", finalDayOfWeek)
      .neq("id", id) // exclude current schedule
      .is("deleted_at", null)
      .or(
        `and(start_time.lte.${finalStartTime},end_time.gt.${finalStartTime}),and(start_time.lt.${finalEndTime},end_time.gte.${finalEndTime}),and(start_time.gte.${finalStartTime},end_time.lte.${finalEndTime})`
      )
      .limit(1);

    if (conflictError) {
      console.error("Error checking conflicts:", conflictError);
      // Don't fail on conflict check errors, just log them
    }

    if (conflictingSchedules && conflictingSchedules.length > 0) {
      const conflict = conflictingSchedules[0];
      return NextResponse.json(
        {
          error: "Conflicto de horario detectado",
          details: `El profesor ya tiene una clase asignada en este horario: "${conflict.name}"`,
        },
        { status: 400 }
      );
    }

    // Verify the profile_id is a professor in the same academy (if changing)
    if (profile_id && profile_id !== existingSchedule.profile_id) {
      const { data: professorProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, role, academy_id")
        .eq("id", profile_id)
        .eq("role", "professor")
        .is("deleted_at", null)
        .single();

      if (profileError || !professorProfile) {
        return NextResponse.json(
          { error: "Perfil de profesor inválido" },
          { status: 400 }
        );
      }

      if (professorProfile.academy_id !== existingSchedule.academy_id) {
        return NextResponse.json(
          { error: "El profesor no pertenece a esta academia" },
          { status: 400 }
        );
      }
    }

    // Update schedule
    const updateData: {
      course_id?: string | null;
      name?: string;
      profile_id?: string;
      day_of_week?: number;
      start_time?: string;
      end_time?: string;
    } = {};

    if (course_id !== undefined) {
      updateData.course_id = resolvedCourseId;
      updateData.name = resolvedName;
      if (resolvedProfileId) updateData.profile_id = resolvedProfileId;
    } else if (name !== undefined) {
      updateData.name = name.trim();
    }

    if (profile_id !== undefined) updateData.profile_id = profile_id;
    if (day_of_week !== undefined) updateData.day_of_week = day_of_week;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;

    const { data: updatedSchedule, error: updateError } = await supabaseAdmin
      .from("schedules")
      .update(updateData)
      .eq("id", id)
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

// DELETE: Soft delete a schedule Delete a schedule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get current schedule to check academy (exclude soft deleted)
    const { data: currentSchedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("academy_id")
      .eq("id", id)
      .is("deleted_at", null)
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

    // Use service role for soft delete
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

    // Soft delete schedule (update deleted_at instead of DELETE)
    const { error: deleteError } = await supabaseAdmin
      .from("schedules")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

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
