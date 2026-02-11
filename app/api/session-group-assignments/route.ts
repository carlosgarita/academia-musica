import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const MAX_ASSIGNMENT_LENGTH = 1500;

/** Verifica que el usuario tenga permiso sobre la sesión (course_session_id). Devuelve false si no. */
async function canAccessCourseSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
  role: string,
  academyId: string | null,
  courseSessionId: string
): Promise<boolean> {
  const { data: cs } = await supabaseAdmin
    .from("course_sessions")
    .select("id, course_id, course:courses(academy_id, profile_id)")
    .eq("id", courseSessionId)
    .maybeSingle();

  if (!cs) return false;
  type CsRow = { id?: string; course_id?: string; course?: { academy_id?: string; profile_id?: string } | null };
  const row = cs as CsRow;
  if (!row.course_id || !row.course) return false;
  if (role === "super_admin") return true;
  if (role === "director" && academyId && row.course.academy_id === academyId) return true;
  if (role === "professor" && row.course.profile_id === userId) return true;
  if (role === "student") {
    const { data: stu } = await supabaseAdmin.from("students").select("id").eq("user_id", userId).maybeSingle();
    if (!stu) return false;
    const { data: reg } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .eq("student_id", (stu as { id: string }).id)
      .eq("course_id", row.course_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (reg) return true;
  }
  if (role === "guardian") {
    const { data: gsRows } = await supabaseAdmin.from("guardian_students").select("student_id").eq("guardian_id", userId);
    const studentIds = (gsRows || []).map((r: { student_id: string }) => r.student_id);
    if (studentIds.length === 0) return false;
    const { data: crList } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .in("student_id", studentIds)
      .eq("course_id", row.course_id)
      .is("deleted_at", null)
      .limit(1);
    if (crList && crList.length > 0) return true;
  }
  return false;
}

// GET: Obtener tarea grupal de una sesión
// Query: ?course_session_id=uuid
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

    if (
      !profile ||
      (profile.role !== "director" &&
        profile.role !== "professor" &&
        profile.role !== "super_admin" &&
        profile.role !== "student" &&
        profile.role !== "guardian")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const periodDateId = searchParams.get("period_date_id");
    const courseSessionId = searchParams.get("course_session_id");

    if (!periodDateId && !courseSessionId) {
      return NextResponse.json(
        { error: "period_date_id or course_session_id is required" },
        { status: 400 }
      );
    }
    if (periodDateId && courseSessionId) {
      return NextResponse.json(
        { error: "Provide period_date_id OR course_session_id, not both" },
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

    const allowed = await canAccessCourseSession(
      supabaseAdmin,
      user.id,
      profile.role,
      profile.academy_id ?? null,
      courseSessionId!
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessionFilter = { course_session_id: courseSessionId };
    const { data: row, error: fetchError } = await supabaseAdmin
      .from("session_group_assignments")
      .select("id, period_date_id, course_session_id, assignment_text, created_at, updated_at")
      .match(sessionFilter)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching session group assignment:", fetchError);
      return NextResponse.json(
        { error: "Error al cargar tarea grupal", details: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      groupAssignment: row
        ? {
            id: row.id,
            course_session_id: row.course_session_id ?? undefined,
            assignment_text: row.assignment_text,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        : null,
    });
  } catch (e) {
    console.error("GET /api/session-group-assignments:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT: Crear o actualizar tarea grupal (upsert)
// Body: { course_session_id, assignment_text }
export async function PUT(request: NextRequest) {
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

    if (
      !profile ||
      (profile.role !== "director" &&
        profile.role !== "professor" &&
        profile.role !== "super_admin")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { course_session_id, assignment_text } = body;

    if (!course_session_id) {
      return NextResponse.json(
        { error: "course_session_id is required" },
        { status: 400 }
      );
    }

    if (assignment_text == null || typeof assignment_text !== "string") {
      return NextResponse.json(
        { error: "assignment_text is required" },
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

    const allowed = await canAccessCourseSession(
      supabaseAdmin,
      user.id,
      profile.role,
      profile.academy_id ?? null,
      course_session_id
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessionFilter = { course_session_id };
    // Texto vacío o solo espacios: eliminar tarea grupal (mismo comportamiento que la UI)
    if (assignment_text.trim() === "") {
      const { error: delError } = await supabaseAdmin
        .from("session_group_assignments")
        .delete()
        .match(sessionFilter);
      if (delError) {
        console.error("Error deleting session group assignment:", delError);
        return NextResponse.json(
          {
            error: "Error al eliminar tarea grupal",
            details: delError.message,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ groupAssignment: null, deleted: true });
    }

    if (assignment_text.length > MAX_ASSIGNMENT_LENGTH) {
      return NextResponse.json(
        {
          error: `assignment_text must be at most ${MAX_ASSIGNMENT_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("session_group_assignments")
      .select("id")
      .match(sessionFilter)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("session_group_assignments")
        .update({
          assignment_text,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating session group assignment:", error);
        return NextResponse.json(
          { error: "Error al actualizar tarea grupal", details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ groupAssignment: updated });
    } else {
      const insertPayload = { course_session_id, assignment_text };
      const { data: created, error } = await supabaseAdmin
        .from("session_group_assignments")
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error("Error creating session group assignment:", error);
        return NextResponse.json(
          { error: "Error al guardar tarea grupal", details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ groupAssignment: created });
    }
  } catch (e) {
    console.error("PUT /api/session-group-assignments:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar tarea grupal de una sesión
// Query: ?course_session_id=uuid
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

    if (
      !profile ||
      (profile.role !== "director" &&
        profile.role !== "professor" &&
        profile.role !== "super_admin")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseSessionId = searchParams.get("course_session_id");

    if (!courseSessionId) {
      return NextResponse.json(
        { error: "course_session_id is required" },
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

    const allowed = await canAccessCourseSession(
      supabaseAdmin,
      user.id,
      profile.role,
      profile.academy_id ?? null,
      courseSessionId
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleteFilter = { course_session_id: courseSessionId };
    const { error } = await supabaseAdmin
      .from("session_group_assignments")
      .delete()
      .match(deleteFilter);

    if (error) {
      console.error("Error deleting session group assignment:", error);
      return NextResponse.json(
        { error: "Error al eliminar tarea grupal", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/session-group-assignments:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
