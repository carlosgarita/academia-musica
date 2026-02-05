import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const MAX_ASSIGNMENT_LENGTH = 1500;

/** Verifica que el usuario tenga permiso sobre la sesión (period_date_id). Devuelve false si no. */
async function canAccessPeriodDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  userId: string,
  role: string,
  academyId: string | null,
  periodDateId: string
): Promise<boolean> {
  const { data: pd } = await supabaseAdmin
    .from("period_dates")
    .select("id, period_id, subject_id, date_type, period:periods(academy_id)")
    .eq("id", periodDateId)
    .maybeSingle();

  if (!pd) return false;
  type PdRow = { id?: string; period_id?: string; subject_id?: string; date_type?: string; period?: { academy_id?: string } | { academy_id?: string }[] | null };
  const row = pd as PdRow;
  if (!row.period_id || !row.subject_id) return false;
  // Solo sesiones de clase pueden tener tarea grupal
  if (row.date_type !== "clase") return false;
  if (role === "super_admin") return true;
  const periodRel = Array.isArray(row.period) ? row.period[0] : row.period;
  if (
    role === "director" &&
    academyId &&
    periodRel?.academy_id === academyId
  )
    return true;
  if (role === "professor") {
    const { data: psp } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("id")
      .eq("period_id", row.period_id)
      .eq("subject_id", row.subject_id)
      .eq("profile_id", userId)
      .maybeSingle();
    if (psp) return true;
  }
  if (role === "student") {
    const { data: cr } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cr) return false;
    const { data: reg } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .eq("student_id", (cr as { id: string }).id)
      .eq("period_id", row.period_id)
      .eq("subject_id", row.subject_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (reg) return true;
  }
  if (role === "guardian") {
    const { data: gsRows } = await supabaseAdmin
      .from("guardian_students")
      .select("student_id")
      .eq("guardian_id", userId);
    const studentIds = (gsRows || []).map(
      (r: { student_id: string }) => r.student_id
    );
    if (studentIds.length === 0) return false;
    const { data: crList } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .in("student_id", studentIds)
      .eq("period_id", row.period_id)
      .eq("subject_id", row.subject_id)
      .is("deleted_at", null)
      .limit(1);
    if (crList && crList.length > 0) return true;
  }
  return false;
}

// GET: Obtener tarea grupal de una sesión
// Query: ?period_date_id=uuid
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

    if (!periodDateId) {
      return NextResponse.json(
        { error: "period_date_id is required" },
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

    const allowed = await canAccessPeriodDate(
      supabaseAdmin,
      user.id,
      profile.role,
      profile.academy_id ?? null,
      periodDateId
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from("session_group_assignments")
      .select("id, period_date_id, assignment_text, created_at, updated_at")
      .eq("period_date_id", periodDateId)
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
            period_date_id: row.period_date_id,
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
// Body: { period_date_id, assignment_text }
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
    const { period_date_id, assignment_text } = body;

    if (!period_date_id) {
      return NextResponse.json(
        { error: "period_date_id is required" },
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

    const allowed = await canAccessPeriodDate(
      supabaseAdmin,
      user.id,
      profile.role,
      profile.academy_id ?? null,
      period_date_id
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Texto vacío o solo espacios: eliminar tarea grupal (mismo comportamiento que la UI)
    if (assignment_text.trim() === "") {
      const { error: delError } = await supabaseAdmin
        .from("session_group_assignments")
        .delete()
        .eq("period_date_id", period_date_id);
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
      .eq("period_date_id", period_date_id)
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
      const { data: created, error } = await supabaseAdmin
        .from("session_group_assignments")
        .insert({
          period_date_id,
          assignment_text,
        })
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
// Query: ?period_date_id=uuid
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
    const periodDateId = searchParams.get("period_date_id");

    if (!periodDateId) {
      return NextResponse.json(
        { error: "period_date_id is required" },
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

    const allowed = await canAccessPeriodDate(
      supabaseAdmin,
      user.id,
      profile.role,
      profile.academy_id ?? null,
      periodDateId
    );
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from("session_group_assignments")
      .delete()
      .eq("period_date_id", periodDateId);

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
