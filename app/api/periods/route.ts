import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List all periods for the user's academy
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

    // Build query
    let query = supabaseAdmin
      .from("periods")
      .select("*")
      .is("deleted_at", null)
      .order("year", { ascending: false })
      .order("period", { ascending: true });

    // Filter by academy (unless super admin)
    if (profile.role !== "super_admin") {
      if (!profile.academy_id) {
        return NextResponse.json(
          { error: "Academy not found" },
          { status: 404 }
        );
      }
      query = query.eq("academy_id", profile.academy_id);
    }

    const { data: periods, error } = await query;

    if (error) {
      console.error("Error fetching periods:", error);
      return NextResponse.json(
        { error: "Failed to fetch periods", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ periods: periods || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/periods:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new period
export async function POST(request: NextRequest) {
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

    // Only directors and super admins can create periods
    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (profile.role !== "super_admin" && !profile.academy_id) {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { year, period } = body;

    // Validation
    if (!year || typeof year !== "number" || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "Year must be between 2000 and 2100" },
        { status: 400 }
      );
    }

    if (!period || !["I", "II", "III", "IV", "V", "VI"].includes(period)) {
      return NextResponse.json(
        { error: "Period must be I, II, III, IV, V, or VI" },
        { status: 400 }
      );
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

    // Check if period already exists
    const { data: existing } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("academy_id", profile.academy_id!)
      .eq("year", year)
      .eq("period", period)
      .is("deleted_at", null)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "This period already exists" },
        { status: 400 }
      );
    }

    // Create period
    const { data: periodData, error: createError } = await supabaseAdmin
      .from("periods")
      .insert({
        academy_id: profile.academy_id!,
        year,
        period,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating period:", createError);
      return NextResponse.json(
        { error: "Failed to create period", details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ period: periodData }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/periods:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
