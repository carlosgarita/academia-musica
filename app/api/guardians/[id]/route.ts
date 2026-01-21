import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single guardian by ID
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
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    // Guardians are profiles with role='guardian'; use admin to bypass RLS (exclude soft deleted)
    const { data: guardian, error } = await supabaseAdmin
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
          student:students!inner(
            id,
            first_name,
            last_name,
            enrollment_status,
            date_of_birth,
            deleted_at
          )
        )
      `
      )
      .eq("id", params.id)
      .eq("role", "guardian")
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching guardian:", error);
      return NextResponse.json(
        { error: "Guardian not found" },
        { status: 404 }
      );
    }

    // Filter out deleted students from guardian_students relationships
    if (guardian.students && Array.isArray(guardian.students)) {
      guardian.students = guardian.students.filter(
        (gs: { student: { deleted_at: string | null } | null }) =>
          gs.student && !gs.student.deleted_at
      );
    }

    if (
      profile.role !== "super_admin" &&
      guardian.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ guardian });
  } catch (error) {
    console.error("Unexpected error in GET /api/guardians/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a guardian
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

    // Get guardian profile to check academy (exclude soft deleted)
    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

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

    const { data: guardianProfile, error: guardianError } = await supabaseAdmin
      .from("profiles")
      .select("academy_id, role")
      .eq("id", params.id)
      .eq("role", "guardian")
      .is("deleted_at", null)
      .single();

    if (guardianError || !guardianProfile) {
      return NextResponse.json(
        { error: "Guardian not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      guardianProfile.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete: update deleted_at instead of deleting auth user

    // Soft delete: update deleted_at instead of deleting auth user
    const { error: deleteError } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error soft deleting guardian:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete guardian", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Guardian deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/guardians/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH: Update a guardian
export async function PATCH(
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
      additional_info,
      status,
      student_ids, // Array of student IDs to assign/update
    } = body;

    // Validation
    if (!email || !first_name || !last_name) {
      return NextResponse.json(
        { error: "First name, last name, and email are required" },
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

    // Verify guardian exists and belongs to same academy (exclude soft deleted)
    const { data: guardianProfile, error: guardianError } = await supabaseAdmin
      .from("profiles")
      .select("academy_id, role")
      .eq("id", params.id)
      .eq("role", "guardian")
      .is("deleted_at", null)
      .single();

    if (guardianError || !guardianProfile) {
      return NextResponse.json(
        { error: "Guardian not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      guardianProfile.academy_id !== academyId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update guardian profile
    const { data: updatedGuardian, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        phone: phone?.trim() || null,
        email: email.trim(),
        additional_info: additional_info?.trim() || null,
        status: status || "active",
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating guardian:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update guardian",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    // Update student assignments if provided
    if (student_ids !== undefined && Array.isArray(student_ids)) {
      // Get current assignments
      const { data: currentAssignments } = await supabaseAdmin
        .from("guardian_students")
        .select("student_id")
        .eq("guardian_id", params.id);

      const currentStudentIds = (currentAssignments || []).map(
        (a: { student_id: string }) => a.student_id
      );

      // Find students to remove
      const toRemove = currentStudentIds.filter(
        (id: string) => !student_ids.includes(id)
      );

      // Find students to add
      const toAdd = student_ids.filter(
        (id: string) => !currentStudentIds.includes(id)
      );

      // Remove assignments
      if (toRemove.length > 0) {
        await supabaseAdmin
          .from("guardian_students")
          .delete()
          .eq("guardian_id", params.id)
          .in("student_id", toRemove);
      }

      // Add new assignments (only if student doesn't have a guardian already)
      if (toAdd.length > 0) {
        // Check which students already have guardians
        const { data: existingGuardians } = await supabaseAdmin
          .from("guardian_students")
          .select("student_id")
          .in("student_id", toAdd);

        const studentsWithGuardians = (existingGuardians || []).map(
          (g: { student_id: string }) => g.student_id
        );

        const studentsToAdd = toAdd.filter(
          (id: string) => !studentsWithGuardians.includes(id)
        );

        if (studentsToAdd.length > 0) {
          const newAssignments = studentsToAdd.map((studentId: string) => ({
            guardian_id: params.id,
            student_id: studentId,
            academy_id: academyId,
            relationship: null,
          }));

          await supabaseAdmin
            .from("guardian_students")
            .insert(newAssignments);
        }
      }
    }

    return NextResponse.json({
      guardian: updatedGuardian,
      message: "Guardian updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/guardians/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

