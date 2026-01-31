import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const VALID_STATUSES = ["presente", "ausente", "tardanza", "justificado"] as const;

// GET: Listar asistencias de una sesión
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

    if (!profile || (profile.role !== "director" && profile.role !== "professor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const periodDateId = searchParams.get("period_date_id");

    if (!periodDateId) {
      return NextResponse.json({ error: "period_date_id is required" }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: attendances, error } = await supabaseAdmin
      .from("session_attendances")
      .select("course_registration_id, attendance_status, notes")
      .eq("period_date_id", periodDateId);

    if (error) {
      console.error("Error fetching attendances:", error);
      return NextResponse.json(
        { error: "Error al cargar asistencias", details: error.message },
        { status: 500 }
      );
    }

    const byRegistration = (attendances || []).reduce<
      Record<string, { attendance_status: string; notes: string | null }>
    >((acc, a) => {
      acc[a.course_registration_id] = {
        attendance_status: a.attendance_status,
        notes: a.notes,
      };
      return acc;
    }, {});

    return NextResponse.json({ attendances: byRegistration });
  } catch (e) {
    console.error("GET /api/session-attendances:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT: Crear o actualizar asistencia (upsert)
// Body: { course_registration_id, period_date_id, attendance_status, notes? }
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

    if (!profile || (profile.role !== "director" && profile.role !== "professor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      course_registration_id,
      period_date_id,
      attendance_status,
      notes,
    } = body;

    if (!course_registration_id || !period_date_id || !attendance_status) {
      return NextResponse.json(
        { error: "course_registration_id, period_date_id and attendance_status are required" },
        { status: 400 }
      );
    }

    if (!VALID_STATUSES.includes(attendance_status)) {
      return NextResponse.json(
        { error: `attendance_status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    if (notes != null && typeof notes === "string" && notes.length > 500) {
      return NextResponse.json({ error: "notes must be at most 500 characters" }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: existing } = await supabaseAdmin
      .from("session_attendances")
      .select("id")
      .eq("course_registration_id", course_registration_id)
      .eq("period_date_id", period_date_id)
      .maybeSingle();

    const payload = {
      course_registration_id,
      period_date_id,
      attendance_status,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("session_attendances")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating attendance:", error);
        return NextResponse.json(
          { error: "Error al actualizar asistencia", details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ attendance: updated });
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("session_attendances")
        .insert({
          course_registration_id,
          period_date_id,
          attendance_status,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating attendance:", error);
        return NextResponse.json(
          { error: "Error al registrar asistencia", details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ attendance: created });
    }
  } catch (e) {
    console.error("PUT /api/session-attendances:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar registro de asistencia (cuando se selecciona "—")
// Query: ?course_registration_id=uuid&period_date_id=uuid
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

    if (!profile || (profile.role !== "director" && profile.role !== "professor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseRegistrationId = searchParams.get("course_registration_id");
    const periodDateId = searchParams.get("period_date_id");

    if (!courseRegistrationId || !periodDateId) {
      return NextResponse.json(
        { error: "course_registration_id and period_date_id are required" },
        { status: 400 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin
      .from("session_attendances")
      .delete()
      .eq("course_registration_id", courseRegistrationId)
      .eq("period_date_id", periodDateId);

    if (error) {
      console.error("Error deleting attendance:", error);
      return NextResponse.json(
        { error: "Error al eliminar asistencia", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/session-attendances:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
