import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Listar badges asignados a un estudiante (por course_registration)
// Query: ?course_registration_id=uuid
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

    const allowedRoles = ["director", "professor", "super_admin", "student", "guardian"];
    if (!profile || !allowedRoles.includes(profile.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseRegistrationId = searchParams.get("course_registration_id");

    if (!courseRegistrationId) {
      return NextResponse.json({ error: "course_registration_id is required" }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: rows, error } = await supabaseAdmin
      .from("student_badges")
      .select(`
        id,
        badge_id,
        notes,
        assigned_at,
        badge:badges(id, name, virtud, description, frase, image_url, deleted_at)
      `)
      .eq("course_registration_id", courseRegistrationId);

    if (error) {
      console.error("Error fetching student_badges:", error);
      return NextResponse.json(
        { error: "Error al cargar badges", details: error.message },
        { status: 500 }
      );
    }

    const badges = (rows || [])
      .filter((r: any) => r.badge && !r.badge.deleted_at)
      .map((r: any) => ({
        id: r.id,
        badge_id: r.badge_id,
        name: r.badge.name,
        virtud: r.badge.virtud,
        description: r.badge.description,
        frase: r.badge.frase,
        image_url: r.badge.image_url,
        notes: r.notes,
        assigned_at: r.assigned_at,
      }));

    return NextResponse.json({ badges });
  } catch (e) {
    console.error("GET /api/student-badges:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Asignar badge a un estudiante
// Body: { course_registration_id, badge_id, notes? }
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

    if (!profile || (profile.role !== "director" && profile.role !== "professor" && profile.role !== "super_admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { course_registration_id, badge_id, notes } = body;

    if (!course_registration_id || !badge_id) {
      return NextResponse.json(
        { error: "course_registration_id and badge_id are required" },
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

    const { error } = await supabaseAdmin.from("student_badges").insert({
      course_registration_id,
      badge_id,
      assigned_by: user.id,
      notes: notes?.trim() || null,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "El badge ya está asignado a este estudiante" }, { status: 409 });
      }
      console.error("Error assigning badge:", error);
      return NextResponse.json(
        { error: "Error al asignar badge", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/student-badges:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Quitar badge de un estudiante
// Query: ?course_registration_id=uuid&badge_id=uuid
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
    const badgeId = searchParams.get("badge_id");

    if (!courseRegistrationId || !badgeId) {
      return NextResponse.json(
        { error: "course_registration_id and badge_id are required" },
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
      .from("student_badges")
      .delete()
      .eq("course_registration_id", courseRegistrationId)
      .eq("badge_id", badgeId);

    if (error) {
      console.error("Error removing badge:", error);
      return NextResponse.json(
        { error: "Error al quitar badge", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/student-badges:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
