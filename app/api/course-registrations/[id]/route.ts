import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Single course registration with songs
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: row, error } = await supabaseAdmin
      .from("course_registrations")
      .select(
        `
        *,
        student:students(id, first_name, last_name, deleted_at),
        subject:subjects(id, name, deleted_at),
        period:periods(id, year, period, deleted_at)
      `
      )
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Course registration not found" }, { status: 404 });
    }

    if (profile && profile.role !== "super_admin" && profile.academy_id && row.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: songRows } = await supabaseAdmin
      .from("course_registration_songs")
      .select("song_id, song:songs(id, name, author, difficulty_level, deleted_at)")
      .eq("course_registration_id", id);

    const songs = (songRows || [])
      .filter((s: any) => s.song && !s.song.deleted_at)
      .map((s: any) => ({ id: s.song.id, name: s.song.name, author: s.song.author, difficulty_level: s.song.difficulty_level }));

    const courseRegistration = {
      ...row,
      student: row.student && !row.student.deleted_at
        ? { id: row.student.id, first_name: row.student.first_name, last_name: row.student.last_name }
        : null,
      subject: row.subject && !row.subject.deleted_at ? { id: row.subject.id, name: row.subject.name } : null,
      period: row.period && !row.period.deleted_at ? { id: row.period.id, year: row.period.year, period: row.period.period } : null,
      songs,
    };

    return NextResponse.json({ courseRegistration });
  } catch (error) {
    console.error("Unexpected error in GET /api/course-registrations/[id]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH: Update course registration (status)
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "director" && profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      .from("course_registrations")
      .select("academy_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Course registration not found" }, { status: 404 });
    }

    if (profile?.role !== "super_admin" && profile?.academy_id && existing.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status } = body;

    const updates: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!["active", "completed", "cancelled"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: reg, error: upErr } = await supabaseAdmin
      .from("course_registrations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (upErr) {
      console.error("Error updating course_registration:", upErr);
      return NextResponse.json({ error: "Failed to update", details: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ courseRegistration: reg });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/course-registrations/[id]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete course registration
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "director" && profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      .from("course_registrations")
      .select("academy_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Course registration not found" }, { status: 404 });
    }

    if (profile?.role !== "super_admin" && profile?.academy_id && existing.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: delErr } = await supabaseAdmin
      .from("course_registrations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (delErr) {
      console.error("Error deleting course_registration:", delErr);
      return NextResponse.json({ error: "Failed to delete", details: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Course registration deleted" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/course-registrations/[id]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
