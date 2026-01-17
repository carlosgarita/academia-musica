import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

// This route uses the service role key to create users
// It should only be accessible to super admins (enforced by middleware)
export async function POST(request: NextRequest) {
  try {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden: Only super admins can create academies" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      // Academy fields
      academyName,
      academyAddress,
      academyPhone,
      academyWebsite,
      // Director fields
      directorFirstName,
      directorLastName,
      directorEmail,
      directorPhone,
      directorPassword,
    } = body;

    // Validate required fields
    if (
      !academyName ||
      !directorFirstName ||
      !directorLastName ||
      !directorEmail ||
      !directorPassword
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json(
        { 
          error: "Server configuration error", 
          details: "SUPABASE_SERVICE_ROLE_KEY environment variable is missing. Please configure it in your .env.local file."
        },
        { status: 500 }
      );
    }

    // Create Supabase client with service role key (bypasses RLS)
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Step 1: Create the academy first
    const { data: academy, error: academyError } = await supabaseAdmin
      .from("academies")
      .insert({
        name: academyName,
        address: academyAddress || null,
        phone: academyPhone || null,
        website: academyWebsite || null,
      })
      .select()
      .single();

    if (academyError) {
      console.error("Error creating academy:", academyError);
      return NextResponse.json(
        { error: "Failed to create academy", details: academyError.message },
        { status: 500 }
      );
    }

    // Step 2: Create the director user in Supabase Auth
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: directorEmail,
        password: directorPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: directorFirstName,
          last_name: directorLastName,
        },
      });

    if (authError || !authUser.user) {
      console.error("Error creating director user:", authError);
      // Rollback: delete the academy if user creation fails
      await supabaseAdmin.from("academies").delete().eq("id", academy.id);
      return NextResponse.json(
        {
          error: "Failed to create director user",
          details: authError?.message || "Unknown error",
        },
        { status: 500 }
      );
    }

    // Step 3: Create the director profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.user.id,
        email: directorEmail,
        first_name: directorFirstName,
        last_name: directorLastName,
        phone: directorPhone || null,
        role: "director",
        academy_id: academy.id,
      });

    if (profileError) {
      console.error("Error creating director profile:", profileError);
      // Rollback: delete the user and academy
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from("academies").delete().eq("id", academy.id);
      return NextResponse.json(
        {
          error: "Failed to create director profile",
          details: profileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        academy: {
          id: academy.id,
          name: academy.name,
        },
        director: {
          id: authUser.user.id,
          email: directorEmail,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in /api/academies:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack }),
      },
      { status: 500 }
    );
  }
}
