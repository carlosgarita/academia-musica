import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single student by ID
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

    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

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

    // Get student (exclude soft deleted)
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching student:", error);
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Check academy access
    if (
      profile.role !== "super_admin" &&
      student.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ student });
  } catch (error) {
    console.error("Unexpected error in GET /api/students/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH: Update a student
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
      date_of_birth,
      additional_info,
      enrollment_status,
    } = body;

    // Validation
    if (!first_name || !last_name) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400 }
      );
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

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

    // Verify student exists and belongs to same academy (exclude soft deleted)
    const { data: studentProfile, error: studentError } = await supabaseAdmin
      .from("students")
      .select("academy_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (studentError || !studentProfile) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      studentProfile.academy_id !== academyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update student
    const { data: updatedStudent, error: updateError } = await supabaseAdmin
      .from("students")
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        date_of_birth: date_of_birth || null,
        additional_info: additional_info?.trim() || null,
        enrollment_status: enrollment_status || "inscrito",
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating student:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update student",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      student: updatedStudent,
      message: "Student updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/students/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a student
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

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

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

    // Verify student exists and belongs to same academy (exclude soft deleted)
    const { data: studentProfile, error: studentError } = await supabaseAdmin
      .from("students")
      .select("academy_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (studentError || !studentProfile) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      studentProfile.academy_id !== academyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete student (update deleted_at instead of DELETE)
    const { error: deleteError } = await supabaseAdmin
      .from("students")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting student:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete student", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/students/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
