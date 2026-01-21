import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List all professors for the director's academy
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

    // Get user profile to check role and academy
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

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
    }

    // Build query - now query from profiles directly (role='professor')
    // Use service role to bypass RLS since there's no policy for directors to view professors
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // First, get basic professor data using admin client (exclude soft deleted)
    let query = supabaseAdmin
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
        updated_at
      `
      )
      .eq("role", "professor")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (profile.role !== "super_admin") {
      query = query.eq("academy_id", academyId);
    }

    const { data: professors, error } = await query;

    if (error) {
      console.error("Error fetching professors:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return NextResponse.json(
        { 
          error: "Failed to fetch professors", 
          details: error.message,
          hint: error.hint || null,
          code: error.code || null
        },
        { status: 500 }
      );
    }

    // Now fetch subjects and schedules for each professor using admin client
    const professorsWithDetails = await Promise.all(
      (professors || []).map(async (prof) => {
        // Fetch subjects (exclude soft deleted - filtered client-side after fetch)
        const { data: professorSubjects } = await supabaseAdmin
          .from("professor_subjects")
          .select(
            `
            subject:subjects(
              id,
              name,
              deleted_at
            )
          `
          )
          .eq("profile_id", prof.id);

        // Filter out soft-deleted subjects
        const activeSubjects = (professorSubjects || []).filter(
          (ps: { subject: { deleted_at: string | null } | null }) =>
            ps.subject && !ps.subject.deleted_at
        );

        // Fetch schedules (exclude soft deleted)
        const { data: schedules } = await supabaseAdmin
          .from("schedules")
          .select("id, name, day_of_week, start_time, end_time")
          .eq("profile_id", prof.id)
          .is("deleted_at", null);

        return {
          ...prof,
          subjects: activeSubjects || [],
          schedules: schedules || [],
        };
      })
    );

    return NextResponse.json({ professors: professorsWithDetails });
  } catch (error) {
    console.error("Unexpected error in GET /api/professors:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new professor
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

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      first_name,
      last_name,
      phone,
      email,
      password,
      additional_info,
      status,
      subject_ids,
    } = body;

    // Validation
    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create user in Supabase Auth
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name,
          last_name,
        },
      });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json(
        {
          error: "Failed to create professor user",
          details: authError.message,
        },
        { status: 400 }
      );
    }

    if (!authUser.user) {
      return NextResponse.json(
        { error: "Failed to create professor user" },
        { status: 500 }
      );
    }

    // Create profile (professors are now just profiles with role='professor')
    const { data: professorProfile, error: profileCreateError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.user.id,
        email,
        first_name,
        last_name,
        phone: phone || null,
        role: "professor",
        academy_id: academyId,
        status: status || "active",
        additional_info: additional_info || null,
      })
      .select()
      .single();

    if (profileCreateError) {
      console.error("Error creating profile:", profileCreateError);
      // Try to clean up auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        {
          error: "Failed to create professor profile",
          details: profileCreateError.message,
        },
        { status: 500 }
      );
    }

    // Associate subjects if provided (now using profile_id instead of professor_id)
    if (subject_ids && Array.isArray(subject_ids) && subject_ids.length > 0) {
      const professorSubjects = subject_ids.map((subjectId: string) => ({
        profile_id: professorProfile.id,
        subject_id: subjectId,
      }));

      const { error: subjectsError } = await supabaseAdmin
        .from("professor_subjects")
        .insert(professorSubjects);

      if (subjectsError) {
        console.error("Error associating subjects:", subjectsError);
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json(
      {
        professor: professorProfile,
        message: "Professor created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/professors:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
