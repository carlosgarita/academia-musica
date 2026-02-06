import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// GET: Get students assigned to the authenticated guardian
// Also supports director/super_admin viewing another guardian's students via ?guardian_id=xxx
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const guardianIdParam = searchParams.get("guardian_id");

    let targetGuardianId: string;

    if (profile.role === "guardian") {
      // Guardian can only see their own students
      targetGuardianId = user.id;
    } else if (profile.role === "director" || profile.role === "super_admin") {
      // Director/super_admin can view any guardian's students
      if (!guardianIdParam) {
        return NextResponse.json(
          { error: "guardian_id is required for director/super_admin" },
          { status: 400 }
        );
      }
      targetGuardianId = guardianIdParam;

      // Verify the guardian exists and belongs to the same academy (for director)
      const { data: guardianProfile, error: guardianError } = await supabase
        .from("profiles")
        .select("id, role, academy_id")
        .eq("id", targetGuardianId)
        .eq("role", "guardian")
        .single();

      if (guardianError || !guardianProfile) {
        return NextResponse.json(
          { error: "Guardian not found" },
          { status: 404 }
        );
      }

      if (
        profile.role === "director" &&
        guardianProfile.academy_id !== profile.academy_id
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get students assigned to the guardian
    const { data: assignments, error } = await supabase
      .from("guardian_students")
      .select(
        `
        id,
        relationship,
        student:students(
          id,
          first_name,
          last_name,
          enrollment_status,
          date_of_birth,
          academy_id,
          deleted_at,
          is_self_guardian
        )
      `
      )
      .eq("guardian_id", targetGuardianId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching guardian students:", error);
      return NextResponse.json(
        { error: "Failed to fetch students", details: error.message },
        { status: 500 }
      );
    }

    // Filter out deleted students and format response
    const students = (assignments || [])
      .filter((a: { student?: { deleted_at?: string | null } }) => a.student && !a.student.deleted_at)
      .map((a: {
        student: {
          id: string;
          first_name: string;
          last_name: string;
          enrollment_status?: string | null;
          date_of_birth?: string | null;
          is_self_guardian?: boolean;
        };
        relationship?: string | null;
        id: string;
      }) => ({
        id: a.student.id,
        first_name: a.student.first_name,
        last_name: a.student.last_name,
        enrollment_status: a.student.enrollment_status,
        date_of_birth: a.student.date_of_birth,
        relationship: a.relationship,
        assignment_id: a.id,
        is_self_guardian: a.student.is_self_guardian ?? false,
      }));

    return NextResponse.json({ students });
  } catch (error) {
    console.error("Unexpected error in GET /api/guardian/students:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
