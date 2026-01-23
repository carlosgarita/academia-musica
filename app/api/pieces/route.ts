import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List all songs for the user's academy
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

    // Use service role to bypass RLS for directors
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
      .from("songs")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

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

    const { data: songs, error } = await query;

    if (error) {
      console.error("Error fetching songs:", error);
      return NextResponse.json(
        { error: "Failed to fetch songs", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ songs: songs || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/songs:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new song
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

    // Only directors and super admins can create songs
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
    const { name, author, difficulty_level } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { error: "Name must be 200 characters or less" },
        { status: 400 }
      );
    }

    if (author && author.length > 200) {
      return NextResponse.json(
        { error: "Author must be 200 characters or less" },
        { status: 400 }
      );
    }

    if (
      !difficulty_level ||
      typeof difficulty_level !== "number" ||
      difficulty_level < 1 ||
      difficulty_level > 5
    ) {
      return NextResponse.json(
        { error: "Difficulty level must be between 1 and 5" },
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

    // Create piece
    const { data: piece, error: createError } = await supabaseAdmin
      .from("songs")
      .insert({
        academy_id: profile.academy_id!,
        name: name.trim(),
        author: author ? author.trim() : null,
        difficulty_level,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating song:", createError);
      return NextResponse.json(
        { error: "Failed to create song", details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ song }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/songs:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
