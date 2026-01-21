import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single professor by ID
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

    // Professors are profiles with role='professor'; use admin to bypass RLS (exclude soft deleted)
    const { data: professor, error } = await supabaseAdmin
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
        subjects:professor_subjects(
          subject:subjects(
            id,
            name,
            deleted_at
          )
        ),
        schedules:schedules(
          id,
          name,
          day_of_week,
          start_time,
          end_time,
          deleted_at
        )
      `
      )
      .eq("id", params.id)
      .eq("role", "professor")
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching professor:", error);
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      professor.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Filter out deleted subjects from professor_subjects relationships
    if (professor.subjects && Array.isArray(professor.subjects)) {
      professor.subjects = professor.subjects.filter(
        (ps: { subject: { deleted_at: string | null } | null }) =>
          ps.subject && !ps.subject.deleted_at
      );
    }

    // Filter out deleted schedules
    if (professor.schedules && Array.isArray(professor.schedules)) {
      professor.schedules = professor.schedules.filter(
        (s: { deleted_at: string | null }) => !s.deleted_at
      );
    }

    return NextResponse.json({ professor });
  } catch (error) {
    console.error("Unexpected error in GET /api/professors/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH: Update a professor
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

    const body = await request.json();
    const {
      first_name,
      last_name,
      email,
      phone,
      additional_info,
      status,
      subject_ids,
    } = body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Nombre, apellido y email son requeridos" },
        { status: 400 }
      );
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

    const { data: professorRow, error: professorError } = await supabaseAdmin
      .from("profiles")
      .select("academy_id, role")
      .eq("id", params.id)
      .eq("role", "professor")
      .is("deleted_at", null)
      .single();

    if (professorError || !professorRow) {
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      professorRow.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim(),
        phone: phone?.trim() || null,
        additional_info: additional_info?.trim() || null,
        status: status || "active",
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating professor:", updateError);
      return NextResponse.json(
        { error: "Failed to update professor", details: updateError.message },
        { status: 500 }
      );
    }

    if (Array.isArray(subject_ids)) {
      await supabaseAdmin
        .from("professor_subjects")
        .delete()
        .eq("profile_id", params.id);

      if (subject_ids.length > 0) {
        const rows = subject_ids.map((subject_id: string) => ({
          profile_id: params.id,
          subject_id,
        }));
        const { error: insertErr } = await supabaseAdmin
          .from("professor_subjects")
          .insert(rows);
        if (insertErr) {
          console.error("Error updating professor_subjects:", insertErr);
          return NextResponse.json(
            {
              error: "Error al actualizar materias",
              details: insertErr.message,
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      professor: updated,
      message: "Professor updated successfully",
    });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/professors/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a professor
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

    // Get professor profile to check academy (exclude soft deleted)
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

    const { data: professorProfile, error: professorError } = await supabaseAdmin
      .from("profiles")
      .select("academy_id, role")
      .eq("id", params.id)
      .eq("role", "professor")
      .is("deleted_at", null)
      .single();

    if (professorError || !professorProfile) {
      return NextResponse.json(
        { error: "Professor not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      professorProfile.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete: update deleted_at instead of deleting auth user
    const { error: deleteError } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error soft deleting professor:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete professor", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Professor deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/professors/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
