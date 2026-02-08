import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List songs for a course registration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: reg } = await supabaseAdmin
      .from("course_registrations")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!reg) {
      return NextResponse.json({ error: "Course registration not found" }, { status: 404 });
    }

    const { data: rows } = await supabaseAdmin
      .from("course_registration_songs")
      .select("song_id, song:songs(id, name, author, difficulty_level, deleted_at)")
      .eq("course_registration_id", id);

    const songs = (rows || [])
      .filter((r: any) => r.song && !r.song.deleted_at)
      .map((r: any) => ({
        id: r.song.id,
        name: r.song.name,
        author: r.song.author,
        difficulty_level: r.song.difficulty_level,
      }));

    return NextResponse.json({ songs });
  } catch (error) {
    console.error("Unexpected error in GET /api/course-registrations/[id]/songs:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: Add songs to a course registration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (
      profile?.role !== "director" &&
      profile?.role !== "professor" &&
      profile?.role !== "super_admin"
    ) {
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

    const { data: reg } = await supabaseAdmin
      .from("course_registrations")
      .select("id, academy_id, profile_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!reg) {
      return NextResponse.json({ error: "Course registration not found" }, { status: 404 });
    }

    if (
      profile?.role !== "super_admin" &&
      profile?.academy_id &&
      reg.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile?.role === "professor" && reg.profile_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const songIds = Array.isArray(body.song_ids) ? body.song_ids : [];

    if (songIds.length === 0) {
      return NextResponse.json({ error: "song_ids array is required" }, { status: 400 });
    }

    const { data: songs } = await supabaseAdmin
      .from("songs")
      .select("id, academy_id, deleted_at")
      .in("id", songIds)
      .is("deleted_at", null);

    const valid = (songs || []).filter((s: any) => s.academy_id === reg.academy_id).map((s: any) => s.id);

    const { data: existing } = await supabaseAdmin
      .from("course_registration_songs")
      .select("song_id")
      .eq("course_registration_id", id)
      .in("song_id", valid);

    const existingIds = new Set((existing || []).map((e: any) => e.song_id));
    const toInsert = valid.filter((sid) => !existingIds.has(sid)).map((sid) => ({ course_registration_id: id, song_id: sid }));

    if (toInsert.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("course_registration_songs").insert(toInsert);
      if (insErr) {
        console.error("Error inserting course_registration_songs:", insErr);
        return NextResponse.json({ error: "Failed to add songs", details: insErr.message }, { status: 500 });
      }
    }

    const { data: rows } = await supabaseAdmin
      .from("course_registration_songs")
      .select("song_id, song:songs(id, name, author, difficulty_level, deleted_at)")
      .eq("course_registration_id", id);

    const result = (rows || [])
      .filter((r: any) => r.song && !r.song.deleted_at)
      .map((r: any) => ({ id: r.song.id, name: r.song.name, author: r.song.author, difficulty_level: r.song.difficulty_level }));

    return NextResponse.json({ songs: result });
  } catch (error) {
    console.error("Unexpected error in POST /api/course-registrations/[id]/songs:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
