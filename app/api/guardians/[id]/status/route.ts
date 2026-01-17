import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

// PATCH: Update guardian status
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

    // Get guardian profile to check academy
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
    const { status: newStatus } = body;

    // Validate status
    if (newStatus !== "active" && newStatus !== "inactive") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'active' or 'inactive'" },
        { status: 400 }
      );
    }

    // Update profile status (guardian is now just a profile)
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", params.id);

    if (updateError) {
      console.error("Error updating guardian status:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update guardian status",
          details: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Guardian status updated successfully",
      status: newStatus,
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/guardians/[id]/status:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
