import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify the user is a super admin
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: Profile | null };

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only super admins can update academy status" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status: newStatus } = body;

    if (newStatus !== "active" && newStatus !== "inactive") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'active' or 'inactive'" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("academies")
      .update({ status: newStatus })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating academy status:", updateError);
      return NextResponse.json(
        { error: "Failed to update academy status", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, status: newStatus },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
