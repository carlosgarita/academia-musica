import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single period by ID with its dates
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

    // Get period with dates
    const { data: period, error: periodError } = await supabaseAdmin
      .from("periods")
      .select("*")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      period.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get period dates
    const { data: dates, error: datesError } = await supabaseAdmin
      .from("period_dates")
      .select(
        `
        *,
        subject:subjects(id, name, deleted_at)
      `
      )
      .eq("period_id", params.id)
      .is("deleted_at", null)
      .order("date", { ascending: true });

    if (datesError) {
      console.error("Error fetching period dates:", datesError);
    }

    return NextResponse.json({
      period: {
        ...period,
        dates: dates || [],
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/periods/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH: Update a period
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

    // Only directors and super admins can update periods
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

    // Verify period exists and user has access
    const { data: existingPeriod, error: fetchError } = await supabaseAdmin
      .from("periods")
      .select("academy_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingPeriod) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      existingPeriod.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { year, period } = body;

    // Build update object
    const updates: any = {};

    if (year !== undefined) {
      if (typeof year !== "number" || year < 2000 || year > 2100) {
        return NextResponse.json(
          { error: "Year must be between 2000 and 2100" },
          { status: 400 }
        );
      }
      updates.year = year;
    }

    if (period !== undefined) {
      if (!["I", "II", "III", "IV", "V", "VI"].includes(period)) {
        return NextResponse.json(
          { error: "Period must be I, II, III, IV, V, or VI" },
          { status: 400 }
        );
      }
      updates.period = period;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Check for duplicate if year or period changed
    if (updates.year || updates.period) {
      const finalYear = updates.year || existingPeriod.year;
      const finalPeriod = updates.period || existingPeriod.period;

      const { data: duplicate } = await supabaseAdmin
        .from("periods")
        .select("id")
        .eq("academy_id", existingPeriod.academy_id)
        .eq("year", finalYear)
        .eq("period", finalPeriod)
        .neq("id", params.id)
        .is("deleted_at", null)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: "This period already exists" },
          { status: 400 }
        );
      }
    }

    // Update period
    const { data: periodData, error: updateError } = await supabaseAdmin
      .from("periods")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating period:", updateError);
      return NextResponse.json(
        { error: "Failed to update period", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ period: periodData });
  } catch (error) {
    console.error("Unexpected error in PATCH /api/periods/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete a period
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

    // Only directors and super admins can delete periods
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

    // Verify period exists and user has access
    const { data: existingPeriod, error: fetchError } = await supabaseAdmin
      .from("periods")
      .select("academy_id")
      .eq("id", params.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingPeriod) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      existingPeriod.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete period (cascade will handle period_dates)
    const { error: deleteError } = await supabaseAdmin
      .from("periods")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", params.id);

    if (deleteError) {
      console.error("Error deleting period:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete period", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Period deleted successfully" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/periods/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
