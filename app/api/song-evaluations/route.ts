import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Listar calificaciones de canciones para una sesión
// Query: ?period_date_id=uuid&course_registration_id=uuid (opcional, si se omite retorna todas de la sesión)
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
    const courseRegistrationId = searchParams.get("course_registration_id");

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

    let query = supabaseAdmin
      .from("song_evaluations")
      .select("course_registration_id, song_id, rubric_id, scale_id")
      .eq("period_date_id", periodDateId);

    if (courseRegistrationId) {
      query = query.eq("course_registration_id", courseRegistrationId);
    }

    const { data: evaluations, error } = await query;

    if (error) {
      console.error("Error fetching song_evaluations:", error);
      return NextResponse.json(
        { error: "Error al cargar calificaciones", details: error.message },
        { status: 500 }
      );
    }

    const byKey: Record<string, string> = {};
    (evaluations || []).forEach((e: any) => {
      const key = `${e.course_registration_id}:${e.song_id}:${e.rubric_id}`;
      if (e.scale_id) byKey[key] = e.scale_id;
    });

    return NextResponse.json({ evaluations: byKey });
  } catch (e) {
    console.error("GET /api/song-evaluations:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT: Crear o actualizar calificación (upsert)
// Body: { course_registration_id, song_id, period_date_id, rubric_id, scale_id }
// scale_id puede ser null para "Sin Calificar"
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
    const { course_registration_id, song_id, period_date_id, rubric_id, scale_id } = body;

    if (!course_registration_id || !song_id || !period_date_id || !rubric_id) {
      return NextResponse.json(
        { error: "course_registration_id, song_id, period_date_id and rubric_id are required" },
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

    const { data: existing } = await supabaseAdmin
      .from("song_evaluations")
      .select("id")
      .eq("course_registration_id", course_registration_id)
      .eq("song_id", song_id)
      .eq("period_date_id", period_date_id)
      .eq("rubric_id", rubric_id)
      .maybeSingle();

    const payload = {
      course_registration_id,
      song_id,
      period_date_id,
      rubric_id,
      scale_id: scale_id || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("song_evaluations")
        .update({ scale_id: payload.scale_id, updated_at: payload.updated_at })
        .eq("id", existing.id);

      if (error) {
        console.error("Error updating song_evaluation:", error);
        return NextResponse.json(
          { error: "Error al actualizar calificación", details: error.message },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabaseAdmin.from("song_evaluations").insert(payload);

      if (error) {
        console.error("Error creating song_evaluation:", error);
        return NextResponse.json(
          { error: "Error al guardar calificación", details: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("PUT /api/song-evaluations:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Eliminar calificación
// Query: ?course_registration_id=uuid&song_id=uuid&period_date_id=uuid&rubric_id=uuid
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
    const songId = searchParams.get("song_id");
    const periodDateId = searchParams.get("period_date_id");
    const rubricId = searchParams.get("rubric_id");

    if (!courseRegistrationId || !songId || !periodDateId || !rubricId) {
      return NextResponse.json(
        { error: "course_registration_id, song_id, period_date_id and rubric_id are required" },
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
      .from("song_evaluations")
      .delete()
      .eq("course_registration_id", courseRegistrationId)
      .eq("song_id", songId)
      .eq("period_date_id", periodDateId)
      .eq("rubric_id", rubricId);

    if (error) {
      console.error("Error deleting song_evaluation:", error);
      return NextResponse.json(
        { error: "Error al eliminar calificación", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/song-evaluations:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
