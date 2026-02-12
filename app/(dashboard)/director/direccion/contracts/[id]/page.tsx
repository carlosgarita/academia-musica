"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Trash2 } from "lucide-react";
import { useAcademyCurrency } from "@/lib/contexts/AcademyCurrencyContext";

type Guardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone?: string | null;
};

type CourseRegLink = {
  id: string;
  course_registration_id: string;
  course_registration?: {
    id: string;
    student?: { id: string; first_name: string; last_name: string };
    subject?: { id: string; name: string };
    period?: { id: string; year: number; period: string };
    course?: { id: string; name: string; year: number };
  };
};

type Invoice = {
  id: string;
  month: string;
  amount: number;
  status: "pendiente" | "pagado";
  paid_at: string | null;
};

type BillingFrequency = "mensual" | "bimestral" | "trimestral" | "cuatrimestral" | "semestral";

type Contract = {
  id: string;
  academy_id: string;
  guardian_id: string;
  monthly_amount: number;
  billing_frequency?: BillingFrequency | null;
  start_date: string;
  end_date: string;
  billing_day?: number | null;
  grace_period_days?: number | null;
  penalty_percent?: number | null;
  created_at: string;
  guardian?: Guardian;
  contract_course_registrations?: CourseRegLink[];
  contract_invoices?: Invoice[];
};

function formatName(first: string | null, last: string | null, email?: string): string {
  const f = first || "";
  const l = last || "";
  if (l && f) return `${l} ${f}`.trim();
  if (l) return l;
  if (f) return f;
  return email || "Sin nombre";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatMonth(monthStr: string): string {
  try {
    const d = new Date(monthStr + "T12:00:00");
    return d.toLocaleDateString("es-CR", { year: "numeric", month: "long" });
  } catch {
    return monthStr;
  }
}

const MONTHS_PER_PERIOD: Record<BillingFrequency, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  cuatrimestral: 4,
  semestral: 6,
};

function formatInvoicePeriod(
  monthStr: string,
  freq: BillingFrequency | null | undefined
): string {
  if (!freq || freq === "mensual") return formatMonth(monthStr);
  const d = new Date(monthStr + "T12:00:00");
  const n = MONTHS_PER_PERIOD[freq];
  const endDate = new Date(d.getFullYear(), d.getMonth() + n, 0);
  const startMonth = d.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const endMonth = endDate.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  return startMonth === endMonth ? startMonth : `${startMonth} – ${endMonth}`;
}

type InvoiceDisplayStatus = "pagado" | "pendiente" | "por_pagar" | "en_gracia" | "vencida";

function getInvoiceDisplayStatus(
  invoice: Invoice,
  contract: Contract
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

function periodLabel(freq: BillingFrequency | null | undefined): string {
  if (!freq || freq === "mensual") return "Facturas mensuales";
  const labels: Record<BillingFrequency, string> = {
    mensual: "Facturas mensuales",
    bimestral: "Facturas bimestrales",
    trimestral: "Facturas trimestrales",
    cuatrimestral: "Facturas cuatrimestrales",
    semestral: "Facturas semestrales",
  };
  return labels[freq] ?? "Facturas";
}

export default function ContractDetailPage() {
  const { formatCurrency } = useAcademyCurrency();
  const params = useParams();
  const id = params?.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadContract();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadContract() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/contracts/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar contrato");
      setContract(data.contract);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function markAsPaid(invoiceId: string) {
    setMarkingPaid(invoiceId);
    try {
      const res = await fetch(
        `/api/contracts/${id}/invoices/${invoiceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pagado" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      await loadContract();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al marcar como pagado");
    } finally {
      setMarkingPaid(null);
    }
  }

  async function deleteInvoice(invoiceId: string) {
    if (!confirm("¿Eliminar esta factura? Solo se pueden eliminar facturas pendientes.")) return;
    setDeletingInvoiceId(invoiceId);
    try {
      const res = await fetch(
        `/api/contracts/${id}/invoices/${invoiceId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      await loadContract();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar factura");
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-600">Cargando contrato...</span>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="space-y-4">
        <Link
          href="/director/direccion/contracts"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Contratos
        </Link>
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error || "Contrato no encontrado"}</p>
        </div>
      </div>
    );
  }

  const guardian = contract.guardian;
  const fullName = guardian
    ? formatName(guardian.first_name, guardian.last_name, guardian.email)
    : "Encargado desconocido";

  const invoices = (contract.contract_invoices || []).sort(
    (a, b) => a.month.localeCompare(b.month)
  );

  const courseRegs = contract.contract_course_registrations || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/director/direccion/contracts"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Contratos
      </Link>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex items-center gap-3">
          <FileText className="h-8 w-8 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contrato</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {fullName} · {formatDate(contract.start_date)} – {formatDate(contract.end_date)}
            </p>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-gray-500">Encargado</h2>
            <p className="mt-1 text-sm text-gray-900">{fullName}</p>
            {guardian?.email && (
              <p className="text-sm text-gray-600">{guardian.email}</p>
            )}
            {guardian?.phone && (
              <p className="text-sm text-gray-600">{guardian.phone}</p>
            )}
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">
              Monto por{" "}
              {!contract.billing_frequency || contract.billing_frequency === "mensual"
                ? "mes"
                : contract.billing_frequency === "bimestral"
                  ? "bimestre"
                  : contract.billing_frequency === "trimestral"
                    ? "trimestre"
                    : contract.billing_frequency === "cuatrimestral"
                      ? "cuatrimestre"
                      : "semestre"}
            </h2>
            <p className="mt-1 text-lg font-medium text-gray-900">
              {formatCurrency(Number(contract.monthly_amount))}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Día de cobro</h2>
            <p className="mt-1 text-sm text-gray-900">
              Día {contract.billing_day ?? 1} de cada mes
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Periodo de gracia</h2>
            <p className="mt-1 text-sm text-gray-900">
              {contract.grace_period_days ?? 5} días
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-gray-500">Multa por morosidad</h2>
            <p className="mt-1 text-sm text-gray-900">
              {contract.penalty_percent ?? 20}%
            </p>
          </div>
          {courseRegs.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-2">
                Matrículas incluidas
              </h2>
              <ul className="space-y-1">
                {courseRegs.map((cr) => {
                  const reg = cr.course_registration;
                  if (!reg) return null;
                  const studentName = reg.student
                    ? `${reg.student.first_name} ${reg.student.last_name}`.trim()
                    : "—";
                  // New flow: course (name, year); legacy: subject + period
                  const courseLabel = reg.course
                    ? reg.course.year
                      ? `${reg.course.name} (${reg.course.year})`
                      : reg.course.name
                    : reg.subject?.name ?? "—";
                  const periodStr = null;
                  return (
                    <li key={cr.id} className="text-sm text-gray-900">
                      <strong>{studentName}</strong> – {courseLabel}
                      {periodStr && (
                        <span className="text-gray-500"> ({periodStr})</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg font-medium text-gray-900">
            {periodLabel(contract.billing_frequency)}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            El director puede marcar como pagado o eliminar facturas pendientes (por ejemplo, si se generó una de más).
          </p>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {invoices.map((inv) => {
              const displayStatus = getInvoiceDisplayStatus(inv, contract);
              const statusLabel =
                displayStatus === "pagado"
                  ? "Pagado"
                  : displayStatus === "por_pagar"
                    ? "Por Pagar"
                    : displayStatus === "en_gracia"
                      ? "En Gracia"
                      : displayStatus === "vencida"
                        ? "Vencida"
                        : "Pendiente";
              const statusClass =
                displayStatus === "pagado"
                  ? "bg-green-100 text-green-800"
                  : displayStatus === "por_pagar" || displayStatus === "en_gracia"
                    ? "bg-green-100 text-green-800"
                    : displayStatus === "vencida"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-800";
              return (
                <li
                  key={inv.id}
                  className="px-4 py-4 sm:px-6 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatInvoicePeriod(inv.month, contract.billing_frequency)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(Number(inv.amount))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
                    >
                      {statusLabel}
                    </span>
                    {displayStatus !== "pagado" && (
                      <>
                        <button
                          type="button"
                          onClick={() => markAsPaid(inv.id)}
                          disabled={markingPaid === inv.id}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {markingPaid === inv.id ? (
                            "Guardando…"
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              Marcar pagado
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteInvoice(inv.id)}
                          disabled={deletingInvoiceId === inv.id}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Eliminar factura (solo pendientes)"
                        >
                          {deletingInvoiceId === inv.id ? (
                            "Eliminando…"
                          ) : (
                            <>
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </>
                          )}
                        </button>
                      </>
                    )}
                    {displayStatus === "pagado" && inv.paid_at && (
                      <span className="text-xs text-gray-500">
                        Pagado: {formatDate(inv.paid_at)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
