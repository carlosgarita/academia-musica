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

// GET: List all academy invoices with filters (year, month, status). For director dashboard.
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
    const monthParam = searchParams.get("month"); // "1".."12" or empty = todos
    const monthFilter =
      monthParam && monthParam !== "todos"
        ? parseInt(monthParam, 10)
        : null;
    const statusParam = searchParams.get("status") || "vencida"; // default vencida
    const statusFilter =
      statusParam === "todos" ? null : (statusParam as InvoiceDisplayStatus);

    const { data: contracts, error: contractsError } = await supabaseAdmin
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
        guardian:profiles!contracts_guardian_id_fkey(
          id,
          first_name,
          last_name,
          email,
          phone
        ),
        contract_invoices(
          id,
          month,
          amount,
          status,
          paid_at
        ),
        contract_course_registrations(
          id,
          course_registration_id,
          course_registration:course_registrations(
            id,
            student:students(id, first_name, last_name),
            course:courses(id, name, year)
          )
        )
      `
      )
      .eq("academy_id", academyId);

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      return NextResponse.json(
        { error: "Error al cargar facturas", details: contractsError.message },
        { status: 500 }
      );
    }

    const list: {
      invoice: {
        id: string;
        month: string;
        amount: number;
        status: string;
        paid_at: string | null;
      };
      contract: Record<string, unknown>;
      guardian: Record<string, unknown> | null;
      display_status: InvoiceDisplayStatus;
      contract_course_registrations?: unknown[];
    }[] = [];

    for (const c of contracts || []) {
      const contract = c as {
        id: string;
        academy_id: string;
        guardian_id: string;
        monthly_amount: number;
        billing_frequency?: string;
        start_date: string;
        end_date: string;
        billing_day?: number | null;
        grace_period_days?: number | null;
        penalty_percent?: number | null;
        guardian?: Record<string, unknown> | null;
        contract_invoices?: Array<{
          id: string;
          month: string;
          amount: number;
          status: string;
          paid_at: string | null;
        }>;
        contract_course_registrations?: unknown[];
      };
      const invoices = contract.contract_invoices || [];
      for (const inv of invoices) {
        const invMonth = inv.month.replace(/^(\d{4})-(\d{2}).*/, "$1-$2-01");
        const invYear = new Date(invMonth + "T12:00:00").getFullYear();
        const invMonthNum = new Date(invMonth + "T12:00:00").getMonth() + 1;
        if (year && invYear !== year) continue;
        if (monthFilter != null && invMonthNum !== monthFilter) continue;

        const display_status = getInvoiceDisplayStatus(inv, contract);
        if (
          statusFilter != null &&
          display_status !== statusFilter
        )
          continue;

        list.push({
          invoice: inv,
          contract: {
            id: contract.id,
            academy_id: contract.academy_id,
            guardian_id: contract.guardian_id,
            monthly_amount: contract.monthly_amount,
            billing_frequency: contract.billing_frequency,
            start_date: contract.start_date,
            end_date: contract.end_date,
            billing_day: contract.billing_day,
            grace_period_days: contract.grace_period_days,
            penalty_percent: contract.penalty_percent,
            contract_course_registrations: contract.contract_course_registrations,
          },
          guardian: contract.guardian ?? null,
          display_status,
        });
      }
    }

    list.sort((a, b) => a.invoice.month.localeCompare(b.invoice.month));

    return NextResponse.json({ invoices: list });
  } catch (error) {
    console.error("Unexpected error in GET /api/director/invoices:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
