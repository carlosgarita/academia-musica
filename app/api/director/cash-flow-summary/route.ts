import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

type InvoiceDisplayStatus =
  | "pagado"
  | "pendiente"
  | "por_pagar"
  | "en_gracia"
  | "vencida";

function getInvoiceDisplayStatus(
  invoice: { month: string; status: string },
  contract: { billing_day?: number | null; grace_period_days?: number | null }
): InvoiceDisplayStatus {
  if (invoice.status === "pagado") return "pagado";
  const billingDay = Math.min(31, Math.max(1, contract.billing_day ?? 1));
  const graceDays = contract.grace_period_days ?? 5;
  const monthStr = invoice.month.replace(/^(\d{4})-(\d{2}).*/, "$1-$2-01");
  const d = new Date(monthStr + "T12:00:00");
  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dueDay = Math.min(billingDay, lastDay);
  const dueDate = new Date(year, month, dueDay);
  dueDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < dueDate) return "pendiente";
  if (today.getTime() === dueDate.getTime()) return "por_pagar";
  const graceEnd = new Date(dueDate);
  graceEnd.setDate(graceEnd.getDate() + graceDays);
  if (today <= graceEnd) return "en_gracia";
  return "vencida";
}

// GET: Cash flow summary (cobrado, pendiente, vencido) for a year and optional month range.
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

    const { searchParams } = new URL(request.url);
    const currentYear = new Date().getFullYear();
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : currentYear;
    const monthStartParam = searchParams.get("month_start");
    const monthEndParam = searchParams.get("month_end");
    const monthStart = monthStartParam
      ? Math.min(12, Math.max(1, parseInt(monthStartParam, 10)))
      : 1;
    const monthEnd = monthEndParam
      ? Math.min(12, Math.max(1, parseInt(monthEndParam, 10)))
      : 12;
    const fromMonth = Math.min(monthStart, monthEnd);
    const toMonth = Math.max(monthStart, monthEnd);

    const { data: contracts, error: contractsError } = await supabaseAdmin
      .from("contracts")
      .select(
        `
        id,
        billing_day,
        grace_period_days,
        contract_invoices(
          id,
          month,
          amount,
          status
        )
      `
      )
      .eq("academy_id", academyId);

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      return NextResponse.json(
        {
          error: "Error al cargar resumen",
          details: contractsError.message,
        },
        { status: 500 }
      );
    }

    let cobrado = 0;
    let pendiente = 0;
    let vencido = 0;

    for (const c of contracts || []) {
      const contract = c as {
        billing_day?: number | null;
        grace_period_days?: number | null;
        contract_invoices?: Array<{
          month: string;
          amount: number;
          status: string;
        }>;
      };
      const invoices = contract.contract_invoices || [];
      for (const inv of invoices) {
        const invMonthStr = inv.month.replace(/^(\d{4})-(\d{2}).*/, "$1-$2-01");
        const invYear = new Date(invMonthStr + "T12:00:00").getFullYear();
        const invMonthNum = new Date(invMonthStr + "T12:00:00").getMonth() + 1;
        if (invYear !== year) continue;
        if (invMonthNum < fromMonth || invMonthNum > toMonth) continue;

        const amount = Number(inv.amount);
        const display_status = getInvoiceDisplayStatus(inv, contract);

        if (display_status === "pagado") {
          cobrado += amount;
        } else if (display_status === "vencida") {
          vencido += amount;
        } else {
          pendiente += amount;
        }
      }
    }

    return NextResponse.json({
      year,
      month_start: fromMonth,
      month_end: toMonth,
      cobrado,
      pendiente,
      vencido,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/director/cash-flow-summary:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
