import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// DELETE: Remove a song from a course registration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> }
) {
  try {
    const { id, songId } = await params;
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

    const { data: reg } = await supabaseAdmin
      .from("course_registrations")
      .select("id, academy_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (!reg) {
      return NextResponse.json({ error: "Course registration not found" }, { status: 404 });
    }

    if (profile?.role !== "super_admin" && profile?.academy_id && reg.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error: delErr } = await supabaseAdmin
      .from("course_registration_songs")
      .delete()
      .eq("course_registration_id", id)
      .eq("song_id", songId);

    if (delErr) {
      console.error("Error deleting course_registration_song:", delErr);
      return NextResponse.json({ error: "Failed to remove song", details: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Song removed" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/course-registrations/[id]/songs/[songId]:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
