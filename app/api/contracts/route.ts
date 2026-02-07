import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: List all contracts for the director's academy
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

    let query = supabaseAdmin
      .from("contracts")
      .select(
        `
        id,
        academy_id,
        guardian_id,
        monthly_amount,
        start_date,
        end_date,
        created_at,
        guardian:profiles!contracts_guardian_id_fkey(
          id,
          first_name,
          last_name,
          email
        )
      `
      )
      .order("created_at", { ascending: false });

    if (profile.role !== "super_admin" && profile.academy_id) {
      query = query.eq("academy_id", profile.academy_id);
    }

    const { data: contracts, error: contractsError } = await query;

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      return NextResponse.json(
        { error: "Failed to fetch contracts", details: contractsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ contracts: contracts || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/contracts:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new contract with course registrations and monthly invoices
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

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
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
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await request.json();
    const {
      guardian_id,
      course_registration_ids,
      monthly_amount,
      start_date,
      end_date,
    } = body;

    // Validation
    if (!guardian_id || !course_registration_ids || !Array.isArray(course_registration_ids) || course_registration_ids.length === 0) {
      return NextResponse.json(
        { error: "guardian_id and course_registration_ids (non-empty array) are required" },
        { status: 400 }
      );
    }

    if (monthly_amount == null || Number(monthly_amount) < 0) {
      return NextResponse.json(
        { error: "monthly_amount must be a non-negative number" },
        { status: 400 }
      );
    }

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return NextResponse.json(
        { error: "Invalid start_date or end_date" },
        { status: 400 }
      );
    }

    // Verify guardian exists and belongs to academy
    const { data: guardianProfile, error: guardianError } = await supabaseAdmin
      .from("profiles")
      .select("id, academy_id, role")
      .eq("id", guardian_id)
      .eq("role", "guardian")
      .is("deleted_at", null)
      .single();

    if (guardianError || !guardianProfile) {
      return NextResponse.json(
        { error: "Guardian not found" },
        { status: 404 }
      );
    }

    if (profile.role !== "super_admin" && guardianProfile.academy_id !== academyId) {
      return NextResponse.json(
        { error: "Guardian does not belong to this academy" },
        { status: 403 }
      );
    }

    const effectiveAcademyId = guardianProfile.academy_id || academyId;

    // Verify all course registrations exist and belong to guardian's students
    const { data: guardianStudents } = await supabaseAdmin
      .from("guardian_students")
      .select("student_id")
      .eq("guardian_id", guardian_id);

    const guardianStudentIds = (guardianStudents || []).map((gs: { student_id: string }) => gs.student_id);

    const { data: registrations, error: regError } = await supabaseAdmin
      .from("course_registrations")
      .select("id, student_id, academy_id")
      .in("id", course_registration_ids)
      .is("deleted_at", null);

    if (regError || !registrations || registrations.length !== course_registration_ids.length) {
      return NextResponse.json(
        { error: "Some course registrations were not found or are invalid" },
        { status: 400 }
      );
    }

    for (const reg of registrations) {
      if (!guardianStudentIds.includes(reg.student_id)) {
        return NextResponse.json(
          { error: "All course registrations must belong to students of the selected guardian" },
          { status: 400 }
        );
      }
      if (reg.academy_id !== effectiveAcademyId) {
        return NextResponse.json(
          { error: "All course registrations must belong to the academy" },
          { status: 400 }
        );
      }
    }

    // Create contract
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        academy_id: effectiveAcademyId,
        guardian_id,
        monthly_amount: Number(monthly_amount),
        start_date: start_date,
        end_date: end_date,
      })
      .select()
      .single();

    if (contractError) {
      console.error("Error creating contract:", contractError);
      return NextResponse.json(
        { error: "Failed to create contract", details: contractError.message },
        { status: 500 }
      );
    }

    // Create contract_course_registrations
    const ccrInserts = course_registration_ids.map((crId: string) => ({
      contract_id: contract.id,
      course_registration_id: crId,
    }));

    const { error: ccrError } = await supabaseAdmin
      .from("contract_course_registrations")
      .insert(ccrInserts);

    if (ccrError) {
      console.error("Error creating contract_course_registrations:", ccrError);
      await supabaseAdmin.from("contracts").delete().eq("id", contract.id);
      return NextResponse.json(
        { error: "Failed to link course registrations", details: ccrError.message },
        { status: 500 }
      );
    }

    // Generate monthly invoices from start_date to end_date
    const invoices: { contract_id: string; month: string; amount: number; status: string }[] = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endMonth) {
      const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
      invoices.push({
        contract_id: contract.id,
        month: monthStr,
        amount: Number(monthly_amount),
        status: "pendiente",
      });
      current.setMonth(current.getMonth() + 1);
    }

    if (invoices.length > 0) {
      const { error: invError } = await supabaseAdmin
        .from("contract_invoices")
        .insert(invoices);

      if (invError) {
        console.error("Error creating invoices:", invError);
        await supabaseAdmin.from("contract_course_registrations").delete().eq("contract_id", contract.id);
        await supabaseAdmin.from("contracts").delete().eq("id", contract.id);
        return NextResponse.json(
          { error: "Failed to create invoices", details: invError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        contract: {
          ...contract,
          course_registration_ids,
          invoices_count: invoices.length,
        },
        message: "Contract created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/contracts:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
