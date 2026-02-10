import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get a single contract by ID with guardian, course registrations, and invoices
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: contract, error } = await supabaseAdmin
      .from("contracts")
      .select(
        `
        id,
        academy_id,
        guardian_id,
        monthly_amount,
        billing_frequency,
        start_date,
        end_date,
        billing_day,
        grace_period_days,
        penalty_percent,
        created_at,
        updated_at,
        guardian:profiles!contracts_guardian_id_fkey(
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        contract_course_registrations(
          id,
          course_registration_id,
          course_registration:course_registrations(
            id,
            student:students(id, first_name, last_name),
            course:courses(id, name, year)
          )
        ),
        contract_invoices(
          id,
          month,
          amount,
          status,
          paid_at
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      contract.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ contract });
  } catch (error) {
    console.error("Unexpected error in GET /api/contracts/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE: Remove a contract (and its invoices / course registration links via CASCADE)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: contract, error: fetchError } = await supabaseAdmin
      .from("contracts")
      .select("id, academy_id")
      .eq("id", id)
      .single();

    if (fetchError || !contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      contract.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get linked course_registrations so we can soft-delete them (matrículas)
    const { data: links } = await supabaseAdmin
      .from("contract_course_registrations")
      .select("course_registration_id")
      .eq("contract_id", id);

    const registrationIds = (links || []).map(
      (r: { course_registration_id: string }) => r.course_registration_id
    );

    if (registrationIds.length > 0) {
      const { error: softDeleteError } = await supabaseAdmin
        .from("course_registrations")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", registrationIds);

      if (softDeleteError) {
        console.error("Error soft-deleting course_registrations:", softDeleteError);
        return NextResponse.json(
          {
            error: "Error al eliminar las matrículas del contrato",
            details: softDeleteError.message,
          },
          { status: 500 }
        );
      }
    }

    const { error: deleteError } = await supabaseAdmin
      .from("contracts")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting contract:", deleteError);
      return NextResponse.json(
        {
          error: "Error al eliminar el contrato",
          details: deleteError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Contrato eliminado" });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/contracts/[id]:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
