import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// DELETE: Remove a student from a schedule (unenroll)
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

    // Get enrollment to verify academy
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("academy_id")
      .eq("id", params.id)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      enrollment.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete enrollment (or mark as cancelled)
    const { error: deleteError } = await supabase
      .from("enrollments")
      .update({ status: "cancelled" })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error deleting enrollment:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove enrollment", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Student removed from schedule successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/enrollments/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
