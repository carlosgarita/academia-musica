import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// GET: Get a single professor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Now professors are just profiles with role='professor'
    const { data: professor, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        first_name,
        last_name,
        email,
        phone,
        status,
        academy_id,
        additional_info,
        created_at,
        updated_at,
        subjects:professor_subjects(
          subject:subjects(
            id,
            name
          )
        ),
        schedules:schedules(
          id,
          name,
          day_of_week,
          start_time,
          end_time
        )
      `
      )
      .eq("id", params.id)
      .eq("role", "professor")
      .single();

    if (error) {
      console.error("Error fetching professor:", error);
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ professor });
  } catch (error) {
    console.error("Unexpected error in GET /api/professors/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a professor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get professor profile to check academy
    const { data: professorProfile, error: professorError } = await supabase
      .from("profiles")
      .select("academy_id, role")
      .eq("id", params.id)
      .eq("role", "professor")
      .single();

    if (professorError || !professorProfile) {
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      professorProfile.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete profile (this will cascade delete auth user and related records)
    // Need to use service role to delete auth user
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Delete auth user (this will cascade delete profile)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      params.id
    );

    if (deleteError) {
      console.error("Error deleting professor:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete professor", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Professor deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/professors/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
