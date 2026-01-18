import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List all guardians for the director's academy
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

    // Build query - now query from profiles directly (role='guardian')
    // Use service role to bypass RLS since there's no policy for directors to view guardians
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

    // Build query using admin client
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
        updated_at,
        students:guardian_students(
          student:students(
            id,
            first_name,
            last_name,
            enrollment_status
          )
        )
      `
      )
      .eq("role", "guardian")
      .order("created_at", { ascending: false });

    if (profile.role !== "super_admin") {
      query = query.eq("academy_id", academyId);
    }

    const { data: guardians, error } = await query;

    if (error) {
      console.error("Error fetching guardians:", error);
      return NextResponse.json(
        { error: "Failed to fetch guardians", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ guardians: guardians || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/guardians:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new guardian
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
      email,
      phone,
      password,
      additional_info,
      status,
      student_ids, // Array of student IDs to assign
    } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
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
          error: "Failed to create guardian user",
          details: authError.message,
        },
        { status: 400 }
      );
    }

    if (!authUser.user) {
      return NextResponse.json(
        { error: "Failed to create guardian user" },
        { status: 500 }
      );
    }

    // Create profile (guardians are now just profiles with role='guardian')
    const { data: guardianProfile, error: profileCreateError } =
      await supabaseAdmin
        .from("profiles")
        .insert({
          id: authUser.user.id,
          email,
          first_name,
          last_name,
          phone: phone || null,
          role: "guardian",
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
          error: "Failed to create guardian profile",
          details: profileCreateError.message,
        },
        { status: 500 }
      );
    }

    // Assign students if provided
    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      const guardianStudentLinks = student_ids.map((studentId: string) => ({
        guardian_id: guardianProfile.id,
        student_id: studentId,
        academy_id: academyId,
        relationship: null, // Can be set later
      }));

      const { error: studentsError } = await supabaseAdmin
        .from("guardian_students")
        .insert(guardianStudentLinks);

      if (studentsError) {
        console.error("Error assigning students:", studentsError);
        // Don't fail the whole operation, just log the error
      }
    }

    return NextResponse.json(
      {
        guardian: guardianProfile,
        message: "Guardian created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/guardians:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
