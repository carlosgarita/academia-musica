import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Helper: Verify guardian has access to a student
async function guardianCanAccessStudent(
  supabaseAdmin: ReturnType<typeof createClient>,
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

// GET: Get task completions for a student
// Query: ?student_id=xxx
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");

    if (!studentId) {
      return NextResponse.json(
        { error: "student_id is required" },
        { status: 400 }
      );
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
    } else if (profile.role === "professor") {
      // Professors can view completions for students in their courses
      const { data: hasAccess } = await supabaseAdmin
        .from("professor_subject_periods")
        .select("id, course_registrations!inner(student_id)")
        .eq("profile_id", user.id)
        .eq("course_registrations.student_id", studentId)
        .limit(1);
      if (!hasAccess || hasAccess.length === 0) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch task completions for the student
    const { data: completions, error: fetchError } = await supabaseAdmin
      .from("task_completions")
      .select(
        `
        id,
        session_assignment_id,
        session_group_assignment_id,
        student_id,
        completed_by,
        completed_at,
        created_at
      `
      )
      .eq("student_id", studentId)
      .order("completed_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching task completions:", fetchError);
      return NextResponse.json(
        {
          error: "Error al cargar tareas completadas",
          details: fetchError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ completions: completions || [] });
  } catch (e) {
    console.error("GET /api/task-completions:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Mark a task as completed
// Body: { session_assignment_id?: string, session_group_assignment_id?: string, student_id: string }
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Guardians, directors, professors, and super_admins can mark tasks
    if (
      profile.role !== "guardian" &&
      profile.role !== "director" &&
      profile.role !== "professor" &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { session_assignment_id, session_group_assignment_id, student_id } =
      body;

    if (!student_id) {
      return NextResponse.json(
        { error: "student_id is required" },
        { status: 400 }
      );
    }

    // Exactly one of the assignment IDs must be provided
    if (
      (!session_assignment_id && !session_group_assignment_id) ||
      (session_assignment_id && session_group_assignment_id)
    ) {
      return NextResponse.json(
        {
          error:
            "Exactly one of session_assignment_id or session_group_assignment_id must be provided",
        },
        { status: 400 }
      );
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

    // Verify guardian has access to this student
    if (profile.role === "guardian") {
      const canAccess = await guardianCanAccessStudent(
        supabaseAdmin,
        user.id,
        student_id
      );
      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "director") {
      // Verify student belongs to director's academy
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("academy_id")
        .eq("id", student_id)
        .maybeSingle();
      if (!student || student.academy_id !== profile.academy_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "professor") {
      // Verify student is in a course the professor teaches (same period+subject)
      const { data: crs } = await supabaseAdmin
        .from("course_registrations")
        .select("period_id, subject_id")
        .eq("student_id", student_id)
        .is("deleted_at", null);
      const { data: pspRows } = await supabaseAdmin
        .from("professor_subject_periods")
        .select("period_id, subject_id")
        .eq("profile_id", user.id);
      const professorTeaches = (periodId: string, subjectId: string) =>
        pspRows?.some(
          (p: { period_id: string; subject_id: string }) =>
            p.period_id === periodId && p.subject_id === subjectId
        );
      const hasAccess =
        crs?.some((c: { period_id: string; subject_id: string }) =>
          professorTeaches(c.period_id, c.subject_id)
        ) ?? false;
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    // super_admin can mark any task

    // Verify the assignment exists and belongs to the student's course
    if (session_assignment_id) {
      const { data: assignment } = await supabaseAdmin
        .from("session_assignments")
        .select("id, course_registration:course_registrations(student_id)")
        .eq("id", session_assignment_id)
        .maybeSingle();

      if (!assignment) {
        return NextResponse.json(
          { error: "Assignment not found" },
          { status: 404 }
        );
      }

      const cr = assignment.course_registration as {
        student_id: string;
      } | null;
      if (!cr || cr.student_id !== student_id) {
        return NextResponse.json(
          { error: "Assignment does not belong to this student" },
          { status: 400 }
        );
      }
    }

    if (session_group_assignment_id) {
      // For group assignments, verify the student is enrolled in the course
      const { data: groupAssignment } = await supabaseAdmin
        .from("session_group_assignments")
        .select(
          `
          id,
          period_date:period_dates(
            period_id,
            subject_id
          )
        `
        )
        .eq("id", session_group_assignment_id)
        .maybeSingle();

      if (!groupAssignment) {
        return NextResponse.json(
          { error: "Group assignment not found" },
          { status: 404 }
        );
      }

      const pd = groupAssignment.period_date as {
        period_id: string;
        subject_id: string;
      } | null;
      if (!pd) {
        return NextResponse.json(
          { error: "Invalid group assignment" },
          { status: 400 }
        );
      }

      // Verify student is enrolled in this course
      const { data: enrollment } = await supabaseAdmin
        .from("course_registrations")
        .select("id")
        .eq("student_id", student_id)
        .eq("period_id", pd.period_id)
        .eq("subject_id", pd.subject_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (!enrollment) {
        return NextResponse.json(
          { error: "Student is not enrolled in this course" },
          { status: 400 }
        );
      }
    }

    // Check if already completed
    let existingQuery = supabaseAdmin
      .from("task_completions")
      .select("id")
      .eq("student_id", student_id);

    if (session_assignment_id) {
      existingQuery = existingQuery.eq(
        "session_assignment_id",
        session_assignment_id
      );
    } else {
      existingQuery = existingQuery.eq(
        "session_group_assignment_id",
        session_group_assignment_id
      );
    }

    const { data: existing } = await existingQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Task already marked as completed" },
        { status: 409 }
      );
    }

    // Create the completion record
    const { data: completion, error: insertError } = await supabaseAdmin
      .from("task_completions")
      .insert({
        session_assignment_id: session_assignment_id || null,
        session_group_assignment_id: session_group_assignment_id || null,
        student_id,
        completed_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating task completion:", insertError);
      return NextResponse.json(
        {
          error: "Error al marcar tarea como completada",
          details: insertError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ completion }, { status: 201 });
  } catch (e) {
    console.error("POST /api/task-completions:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Unmark a task as completed
// Query: ?id=xxx OR ?session_assignment_id=xxx&student_id=xxx OR ?session_group_assignment_id=xxx&student_id=xxx
export async function DELETE(request: NextRequest) {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Guardians, directors, professors, and super_admins can unmark tasks
    if (
      profile.role !== "guardian" &&
      profile.role !== "director" &&
      profile.role !== "professor" &&
      profile.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const completionId = searchParams.get("id");
    const sessionAssignmentId = searchParams.get("session_assignment_id");
    const sessionGroupAssignmentId = searchParams.get(
      "session_group_assignment_id"
    );
    const studentId = searchParams.get("student_id");

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

    let completionToDelete: { id: string; student_id: string } | null = null;

    if (completionId) {
      // Delete by completion ID
      const { data } = await supabaseAdmin
        .from("task_completions")
        .select("id, student_id")
        .eq("id", completionId)
        .maybeSingle();
      completionToDelete = data;
    } else if (studentId && (sessionAssignmentId || sessionGroupAssignmentId)) {
      // Delete by assignment + student
      let query = supabaseAdmin
        .from("task_completions")
        .select("id, student_id")
        .eq("student_id", studentId);

      if (sessionAssignmentId) {
        query = query.eq("session_assignment_id", sessionAssignmentId);
      } else {
        query = query.eq(
          "session_group_assignment_id",
          sessionGroupAssignmentId
        );
      }

      const { data } = await query.maybeSingle();
      completionToDelete = data;
    } else {
      return NextResponse.json(
        {
          error:
            "Either id or (session_assignment_id/session_group_assignment_id + student_id) is required",
        },
        { status: 400 }
      );
    }

    if (!completionToDelete) {
      return NextResponse.json(
        { error: "Task completion not found" },
        { status: 404 }
      );
    }

    // Verify access
    if (profile.role === "guardian") {
      const canAccess = await guardianCanAccessStudent(
        supabaseAdmin,
        user.id,
        completionToDelete.student_id
      );
      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "director") {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("academy_id")
        .eq("id", completionToDelete.student_id)
        .maybeSingle();
      if (!student || student.academy_id !== profile.academy_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "professor") {
      const { data: crs } = await supabaseAdmin
        .from("course_registrations")
        .select("period_id, subject_id")
        .eq("student_id", completionToDelete.student_id)
        .is("deleted_at", null);
      const { data: pspRows } = await supabaseAdmin
        .from("professor_subject_periods")
        .select("period_id, subject_id")
        .eq("profile_id", user.id);
      const professorTeaches = (periodId: string, subjectId: string) =>
        pspRows?.some(
          (p: { period_id: string; subject_id: string }) =>
            p.period_id === periodId && p.subject_id === subjectId
        );
      const hasAccess =
        crs?.some((c: { period_id: string; subject_id: string }) =>
          professorTeaches(c.period_id, c.subject_id)
        ) ?? false;
      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Delete the completion
    const { error: deleteError } = await supabaseAdmin
      .from("task_completions")
      .delete()
      .eq("id", completionToDelete.id);

    if (deleteError) {
      console.error("Error deleting task completion:", deleteError);
      return NextResponse.json(
        { error: "Error al desmarcar tarea", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/task-completions:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
