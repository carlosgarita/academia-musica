import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// GET: Get all enrollments for a schedule
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

    const { data: enrollments, error } = await supabase
      .from("enrollments")
      .select(
        `
        *,
        student:students(
          id,
          first_name,
          last_name,
          enrollment_status
        )
      `
      )
      .eq("schedule_id", params.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching enrollments:", error);
      return NextResponse.json(
        { error: "Failed to fetch enrollments", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ enrollments: enrollments || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/schedules/[id]/enrollments:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Enroll students in a schedule (bulk enrollment)
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

    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get schedule to verify academy
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("academy_id, profile_id")
      .eq("id", params.id)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Verify academy (schedules.academy_id is the source of truth for security)
    if (
      profile.role !== "super_admin" &&
      schedule.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scheduleAcademyId = schedule.academy_id;

    const body = await request.json();
    const { student_ids } = body; // array of student IDs

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json(
        { error: "student_ids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Check for conflicts for each student
    const enrollments = [];
    const errors = [];
    const conflicts = [];

    for (const student_id of student_ids) {
      // Check if already enrolled
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("schedule_id", params.id)
        .eq("student_id", student_id)
        .eq("status", "active")
        .single();

      if (existing) {
        errors.push(`Estudiante ya está inscrito en esta clase`);
        continue;
      }

      // Check for schedule conflicts
      const { data: studentConflicts, error: conflictError } = await supabase.rpc(
        "check_student_schedule_conflicts",
        {
          p_student_id: student_id,
          p_schedule_id: params.id,
          p_academy_id: scheduleAcademyId,
        }
      );

      if (conflictError) {
        console.error("Error checking student conflicts:", conflictError);
        errors.push(`Error verificando conflictos para estudiante`);
        continue;
      }

      if (studentConflicts && studentConflicts.length > 0) {
        const conflict = studentConflicts[0];
        conflicts.push({
          student_id,
          conflict: `${conflict.conflict_message}: ${conflict.conflicting_schedule_name} (${conflict.conflicting_schedule_day}, ${conflict.conflicting_schedule_time})`,
        });
        continue;
      }

      // Create enrollment
      const { data: enrollment, error: enrollError } = await supabase
        .from("enrollments")
        .insert({
          student_id,
          schedule_id: params.id,
          academy_id: scheduleAcademyId,
          teacher_id: schedule.profile_id,
          status: "active",
        })
        .select()
        .single();

      if (enrollError) {
        console.error("Error creating enrollment:", enrollError);
        errors.push(`Error inscribiendo estudiante`);
        continue;
      }

      enrollments.push(enrollment);
    }

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          enrollments,
          conflicts,
          message: "Some enrollments were created, but some had conflicts",
        },
        { status: 207 } // Multi-Status
      );
    }

    if (errors.length > 0 && enrollments.length === 0) {
      return NextResponse.json(
        { error: "Failed to enroll students", details: errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        enrollments,
        message: "Students enrolled successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/schedules/[id]/enrollments:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
