import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// PATCH: Update invoice status (mark as paid)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const { id: contractId, invoiceId } = await params;
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

    const body = await request.json();
    const { status: newStatus } = body;

    if (newStatus !== "pagado") {
      return NextResponse.json(
        { error: "Only status 'pagado' is allowed" },
        { status: 400 }
      );
    }

    // Verify invoice exists and belongs to contract
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("contract_invoices")
      .select("id, contract_id, status")
      .eq("id", invoiceId)
      .eq("contract_id", contractId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.status === "pagado") {
      return NextResponse.json(
        { error: "Invoice is already marked as paid" },
        { status: 400 }
      );
    }

    // Verify contract belongs to academy
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .select("academy_id")
      .eq("id", contractId)
      .single();

    if (contractError || !contract) {
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

    const paidAt = new Date().toISOString();

    const { data: updatedInvoice, error: updateError } = await supabaseAdmin
      .from("contract_invoices")
      .update({ status: "pagado", paid_at: paidAt })
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      invoice: updatedInvoice,
      message: "Invoice marked as paid",
    });
  } catch (error) {
    console.error(
      "Unexpected error in PATCH /api/contracts/[id]/invoices/[invoiceId]:",
      error
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
