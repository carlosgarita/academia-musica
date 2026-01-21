import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single subject by ID
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

    const { data: subject, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching subject:", error);
      return NextResponse.json(
        { error: "Subject not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ subject });
  } catch (error) {
    console.error("Unexpected error in GET /api/subjects/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH: Update a subject
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

    // Get current subject to check academy (exclude soft deleted)
    const { data: currentSubject, error: subjectError } = await supabase
      .from("subjects")
      .select("academy_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (subjectError || !currentSubject) {
      return NextResponse.json(
        { error: "Subject not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      currentSubject.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;

    const { data: updatedSubject, error: updateError } = await supabase
      .from("subjects")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating subject:", updateError);
      return NextResponse.json(
        { error: "Failed to update subject", details: updateError.message },
        { status: 500 }
      );
    }

    // If name was updated, also update the denormalized name in schedules table
    if (name !== undefined && updatedSubject) {
      // Use service role to bypass RLS for updating schedules
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
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

        const { error: schedulesUpdateError } = await supabaseAdmin
          .from("schedules")
          .update({ name: updatedSubject.name })
          .eq("subject_id", params.id)
          .is("deleted_at", null); // Only update non-deleted schedules

        if (schedulesUpdateError) {
          console.error("Error updating schedules name:", schedulesUpdateError);
          console.error("Error details:", JSON.stringify(schedulesUpdateError, null, 2));
          // Don't fail the whole operation, just log the error
          // The subject update was successful, so we return success
        } else {
          console.log(`Successfully updated schedules name for subject ${params.id}`);
        }
      } else {
        console.warn("SUPABASE_SERVICE_ROLE_KEY not set, skipping schedules name update");
      }
    }

    return NextResponse.json({ subject: updatedSubject });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/subjects/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a subject
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

    // Get current subject to check academy (exclude soft deleted)
    const { data: currentSubject, error: subjectError } = await supabase
      .from("subjects")
      .select("academy_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (subjectError || !currentSubject) {
      return NextResponse.json(
        { error: "Subject not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      currentSubject.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete subject (update deleted_at instead of DELETE)
    const { error: deleteError } = await supabase
      .from("subjects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error deleting subject:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete subject", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Subject deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/subjects/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
