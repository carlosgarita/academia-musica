import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// PATCH: Update a period date
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; dateId: string } }
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

    // Only directors and super admins can update dates
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

    // Verify period date exists and user has access
    const { data: existingDate, error: fetchError } = await supabaseAdmin
      .from("period_dates")
      .select(
        `
        *,
        period:periods!inner(
          academy_id
        )
      `
      )
      .eq("id", params.dateId)
      .eq("period_id", params.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingDate) {
      return NextResponse.json({ error: "Date not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      existingDate.period.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { date_type, date, subject_id, comment } = body;

    // Build update object
    const updates: Record<string, unknown> = {};

    if (date_type !== undefined) {
      if (!["inicio", "cierre", "feriado", "recital", "clase", "otro"].includes(date_type)) {
        return NextResponse.json(
          { error: "Invalid date_type" },
          { status: 400 }
        );
      }
      updates.date_type = date_type;
    }

    if (date !== undefined) {
      if (typeof date !== "string") {
        return NextResponse.json(
          { error: "date must be a string (YYYY-MM-DD)" },
          { status: 400 }
        );
      }
      updates.date = date;
    }

    if (subject_id !== undefined) {
      if (subject_id === null || subject_id === "") {
        updates.subject_id = null;
      } else {
        // Validate subject exists
        const { data: subject, error: subjectError } = await supabaseAdmin
          .from("subjects")
          .select("id, academy_id, deleted_at")
          .eq("id", subject_id)
          .single();

        if (subjectError || !subject || subject.deleted_at) {
          return NextResponse.json(
            { error: "Materia (subject) no encontrada" },
            { status: 404 }
          );
        }

        // Verify subject belongs to same academy
        if (subject.academy_id !== existingDate.period.academy_id) {
          return NextResponse.json(
            { error: "La materia no pertenece a esta academia" },
            { status: 403 }
          );
        }

        updates.subject_id = subject_id;
      }
    }

    if (comment !== undefined) {
      if (comment === null || comment === "") {
        updates.comment = null;
      } else {
        if (typeof comment !== "string" || comment.length > 500) {
          return NextResponse.json(
            { error: "comment must be 500 characters or less" },
            { status: 400 }
          );
        }
        updates.comment = comment;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update date
    const { data: updatedDate, error: updateError } = await supabaseAdmin
      .from("period_dates")
      .update(updates)
      .eq("id", params.dateId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating period date:", updateError);
      return NextResponse.json(
        { error: "Failed to update date", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ date: updatedDate });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/periods/[id]/dates/[dateId]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete a period date
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; dateId: string } }
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

    // Only directors and super admins can delete dates
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

    // Verify period date exists and user has access
    const { data: existingDate, error: fetchError } = await supabaseAdmin
      .from("period_dates")
      .select(
        `
        *,
        period:periods!inner(
          academy_id
        )
      `
      )
      .eq("id", params.dateId)
      .eq("period_id", params.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingDate) {
      return NextResponse.json({ error: "Date not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      existingDate.period.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete
    const { error: deleteError } = await supabaseAdmin
      .from("period_dates")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.dateId);

    if (deleteError) {
      console.error("Error deleting period date:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete date", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Date deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/periods/[id]/dates/[dateId]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
