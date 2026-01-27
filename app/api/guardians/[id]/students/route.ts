import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// GET: Get students assigned to a guardian
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

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (
      profile.role !== "director" &&
      profile.role !== "super_admin" &&
      profile.id !== params.id // Guardians can view their own assignments
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get guardian_students for this guardian
    const { data: assignments, error } = await supabase
      .from("guardian_students")
      .select(
        `
        id,
        relationship,
        created_at,
        student:students(
          id,
          first_name,
          last_name,
          enrollment_status,
          date_of_birth
        )
      `
      )
      .eq("guardian_id", params.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching guardian students:", error);
      return NextResponse.json(
        { error: "Failed to fetch assignments", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ assignments: assignments || [] });
  } catch (error) {
    console.error(
      "Unexpected error in GET /api/guardians/[id]/students:",
      error
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Assign students to a guardian
export async function POST(
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

    // Get guardian profile to verify academy
    const { data: guardianProfile, error: guardianError } = await supabase
      .from("profiles")
      .select("academy_id, role")
      .eq("id", params.id)
      .eq("role", "guardian")
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

    const body = await request.json();
    const { student_ids, relationship } = body; // array of student IDs

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json(
        { error: "student_ids must be a non-empty array" },
        { status: 400 }
      );
    }

    // Verify all students belong to the same academy (exclude soft deleted)
    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("id, academy_id")
      .in("id", student_ids)
      .is("deleted_at", null);

    if (studentsError || !students) {
      return NextResponse.json(
        { error: "Failed to verify students" },
        { status: 500 }
      );
    }

    if (students.length !== student_ids.length) {
      return NextResponse.json(
        { error: "Some students were not found" },
        { status: 400 }
      );
    }

    // Verify all students belong to the same academy
    const invalidStudents = students.filter(
      (s) => s.academy_id !== guardianProfile.academy_id
    );
    if (invalidStudents.length > 0) {
      return NextResponse.json(
        { error: "Some students do not belong to this academy" },
        { status: 400 }
      );
    }

    // Check if any of these students already have a guardian assigned
    const { data: existingAssignments } = await supabase
      .from("guardian_students")
      .select("student_id, student:students(id, first_name, last_name)")
      .in("student_id", student_ids);

    if (existingAssignments && existingAssignments.length > 0) {
      // Obtener nombres de estudiantes ya asignados para el mensaje
      const studentNames = existingAssignments
        .map((a: any) => {
          const student = a.student;
          if (student) {
            return `${student.first_name || ""} ${student.last_name || ""}`.trim() || `ID: ${a.student_id}`;
          }
          return `ID: ${a.student_id}`;
        })
        .filter(Boolean);
      
      const studentList = studentNames.length > 0 
        ? studentNames.join(", ")
        : "uno o más estudiantes";
      
      return NextResponse.json(
        {
          error: "Uno o más estudiantes ya tienen un encargado asignado",
          details: `Los siguientes estudiantes ya están asignados a otro encargado: ${studentList}. Cada estudiante solo puede tener un encargado asignado.`,
        },
        { status: 400 }
      );
    }

    // Create guardian_students records (one-to-one: each student gets one guardian)
    const assignments = student_ids.map((studentId: string) => ({
      guardian_id: params.id,
      student_id: studentId,
      academy_id: guardianProfile.academy_id,
      relationship: relationship || null,
    }));

    const { data: createdAssignments, error: assignError } = await supabase
      .from("guardian_students")
      .insert(assignments)
      .select();

    if (assignError) {
      console.error("Error assigning students:", assignError);
      return NextResponse.json(
        {
          error: "Failed to assign students",
          details: assignError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        assignments: createdAssignments,
        message: "Students assigned successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/guardians/[id]/students:",
      error
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Remove a student assignment from a guardian
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

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignment_id");

    if (!assignmentId) {
      return NextResponse.json(
        { error: "assignment_id is required" },
        { status: 400 }
      );
    }

    // Get assignment to verify academy
    const { data: assignment, error: assignmentError } = await supabase
      .from("guardian_students")
      .select("academy_id, guardian_id")
      .eq("id", assignmentId)
      .single();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      assignment.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete assignment
    const { error: deleteError } = await supabase
      .from("guardian_students")
      .delete()
      .eq("id", assignmentId);

    if (deleteError) {
      console.error("Error deleting assignment:", deleteError);
      return NextResponse.json(
        {
          error: "Failed to remove assignment",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Student assignment removed successfully",
    });
  } catch (error) {
    console.error(
      "Unexpected error in DELETE /api/guardians/[id]/students:",
      error
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
