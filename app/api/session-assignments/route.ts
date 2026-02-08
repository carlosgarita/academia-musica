import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const MAX_ASSIGNMENT_LENGTH = 1500;

// GET: Listar tareas individuales de una sesión
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

    const { data: assignments, error } = await supabaseAdmin
      .from("session_assignments")
      .select("id, course_registration_id, assignment_text")
      .eq("course_session_id", courseSessionId);

    if (error) {
      console.error("Error fetching assignments:", error);
      return NextResponse.json(
        { error: "Error al cargar tareas", details: error.message },
        { status: 500 }
      );
    }

    // Keep backward compatibility: assignments is { [regId]: text }
    // Add assignmentDetails with full info including ID
    const byRegistration = (assignments || []).reduce<Record<string, string>>(
      (acc, a) => {
        acc[a.course_registration_id] = a.assignment_text;
        return acc;
      },
      {}
    );

    const assignmentDetails = (assignments || []).reduce<
      Record<string, { id: string; text: string }>
    >((acc, a) => {
      acc[a.course_registration_id] = {
        id: a.id,
        text: a.assignment_text,
      };
      return acc;
    }, {});

    return NextResponse.json({
      assignments: byRegistration,
      assignmentDetails,
    });
  } catch (e) {
    console.error("GET /api/session-assignments:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT: Crear o actualizar tarea (upsert)
// Body: { course_registration_id, course_session_id, assignment_text }
// assignment_text es obligatorio (texto, max 1500 chars). Para borrar, usar DELETE.
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
    const { course_registration_id, course_session_id, assignment_text } = body;

    if (!course_registration_id) {
      return NextResponse.json(
        { error: "course_registration_id is required" },
        { status: 400 }
      );
    }
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

    if (assignment_text.length > MAX_ASSIGNMENT_LENGTH) {
      return NextResponse.json(
        {
          error: `assignment_text must be at most ${MAX_ASSIGNMENT_LENGTH} characters`,
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

    const { data: existing, error: findError } = await supabaseAdmin
      .from("session_assignments")
      .select("id")
      .eq("course_registration_id", course_registration_id)
      .eq("course_session_id", course_session_id)
      .maybeSingle();

    if (findError) {
      console.error("Error finding existing assignment:", findError);
      return NextResponse.json(
        { error: "Error al buscar tarea", details: findError.message },
        { status: 500 }
      );
    }

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("session_assignments")
        .update({ assignment_text, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating assignment:", error);
        return NextResponse.json(
          { error: "Error al actualizar tarea", details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ assignment: updated });
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("session_assignments")
        .insert({
          course_registration_id,
          course_session_id,
          assignment_text,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating assignment:", error);
        return NextResponse.json(
          { error: "Error al guardar tarea", details: error.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ assignment: created });
    }
  } catch (e) {
    console.error("PUT /api/session-assignments:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar tarea
// Query: ?course_registration_id=uuid&course_session_id=uuid
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
    const courseRegistrationId = searchParams.get("course_registration_id");
    const courseSessionId = searchParams.get("course_session_id");

    if (!courseRegistrationId) {
      return NextResponse.json(
        { error: "course_registration_id is required" },
        { status: 400 }
      );
    }
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

    const { error } = await supabaseAdmin
      .from("session_assignments")
      .delete()
      .eq("course_registration_id", courseRegistrationId)
      .eq("course_session_id", courseSessionId);

    if (error) {
      console.error("Error deleting assignment:", error);
      return NextResponse.json(
        { error: "Error al eliminar tarea", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/session-assignments:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
