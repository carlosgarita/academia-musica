"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Check, FileText } from "lucide-react";
import { useAcademyCurrency } from "@/lib/contexts/AcademyCurrencyContext";

type Guardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string;
  phone?: string | null;
};

type InvoiceRow = {
  id: string;
  month: string;
  amount: number;
  status: string;
  paid_at: string | null;
};

type ContractRow = {
  id: string;
  monthly_amount: number;
  billing_frequency?: string | null;
  start_date: string;
  end_date: string;
  billing_day?: number | null;
  grace_period_days?: number | null;
  penalty_percent?: number | null;
};

type CourseReg = {
  id: string;
  course_registration?: {
    student?: { first_name: string; last_name: string };
    course?: { name: string; year: number };
  };
};

type Item = {
  invoice: InvoiceRow;
  contract: ContractRow & { contract_course_registrations?: CourseReg[] };
  guardian: Guardian | null;
  display_status: "pagado" | "pendiente" | "por_pagar" | "en_gracia" | "vencida";
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

const MONTHS_PER_PERIOD: Record<string, number> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  cuatrimestral: 4,
  semestral: 6,
};

function formatInvoicePeriod(monthStr: string, freq: string | null | undefined): string {
  if (!freq || freq === "mensual") return formatMonth(monthStr);
  const d = new Date(monthStr + "T12:00:00");
  const n = MONTHS_PER_PERIOD[freq] ?? 1;
  const endDate = new Date(d.getFullYear(), d.getMonth() + n, 0);
  const startMonth = d.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const endMonth = endDate.toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  return startMonth === endMonth ? startMonth : `${startMonth} – ${endMonth}`;
}

const STATUS_LABELS: Record<string, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  por_pagar: "Por Pagar",
  en_gracia: "En Gracia",
  vencida: "Vencida",
};

const STATUS_CLASS: Record<string, string> = {
  pagado: "bg-green-100 text-green-800",
  por_pagar: "bg-green-100 text-green-800",
  en_gracia: "bg-green-100 text-green-800",
  vencida: "bg-red-100 text-red-800",
  pendiente: "bg-gray-100 text-gray-800",
};

const PERIOD_LABEL: Record<string, string> = {
  mensual: "mes",
  bimestral: "bimestre",
  trimestral: "trimestre",
  cuatrimestral: "cuatrimestre",
  semestral: "semestre",
};

export function FinancialInvoicesCard() {
  const { formatCurrency } = useAcademyCurrency();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState<string>("todos");
  const [status, setStatus] = useState<string>("vencida");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          year: String(year),
          status,
        });
        if (month !== "todos") params.set("month", month);
        const res = await fetch(`/api/director/invoices?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar facturas");
        if (!cancelled) setItems(data.invoices || []);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error al cargar facturas");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [year, month, status]);

  async function markAsPaid(contractId: string, invoiceId: string) {
    setMarkingPaidId(invoiceId);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/invoices/${invoiceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "pagado" }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar");
      setItems((prev) =>
        prev.map((item) =>
          item.invoice.id === invoiceId
            ? {
                ...item,
                invoice: { ...item.invoice, status: "pagado" as const },
                display_status: "pagado" as const,
              }
            : item
        )
      );
      if (expandedId === invoiceId) setExpandedId(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al marcar como pagado");
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg mt-8">
      <div className="px-4 py-5 sm:px-6 flex items-center gap-3">
        <FileText className="h-8 w-8 text-indigo-600" />
        <div>
          <h2 className="text-lg font-medium text-gray-900">Estado financiero</h2>
          <p className="text-sm text-gray-500">
            Facturas de la academia. Filtra por año, mes y estado.
          </p>
        </div>
      </div>
      <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Año</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="todos">Todos</option>
              {[
                "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
              ].map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="todos">Todos</option>
              <option value="vencida">Vencidas</option>
              <option value="en_gracia">En Gracia</option>
              <option value="por_pagar">Por Pagar</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Pagadas</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 py-4">Cargando facturas...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No hay facturas con los filtros seleccionados.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {items.map((item) => {
              const isExpanded = expandedId === item.invoice.id;
              const guardian = item.guardian;
              const fullName = guardian
                ? formatName(guardian.first_name, guardian.last_name, guardian.email)
                : "—";
              const statusLabel = STATUS_LABELS[item.display_status] ?? item.display_status;
              const statusClass = STATUS_CLASS[item.display_status] ?? "bg-gray-100 text-gray-800";
              const periodLabel = PERIOD_LABEL[item.contract.billing_frequency ?? "mensual"] ?? "mes";

              return (
                <li key={item.invoice.id} className="py-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.invoice.id)
                      }
                      className="inline-flex items-center gap-2 text-left flex-1 min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {formatInvoicePeriod(
                          item.invoice.month,
                          item.contract.billing_frequency
                        )}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatCurrency(Number(item.invoice.amount))}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </button>
                    {item.display_status !== "pagado" && (
                      <button
                        type="button"
                        onClick={() =>
                          markAsPaid(item.contract.id, item.invoice.id)
                        }
                        disabled={markingPaidId === item.invoice.id}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 flex-shrink-0"
                      >
                        {markingPaidId === item.invoice.id ? (
                          "Guardando…"
                        ) : (
                          <>
                            <Check className="h-3 w-3" />
                            Marcar pagado
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pl-6 pr-2 py-3 bg-gray-50 rounded-md border border-gray-100 text-sm space-y-3">
                      <p className="font-medium text-gray-700">
                        Mes que se cobra: {formatInvoicePeriod(
                          item.invoice.month,
                          item.contract.billing_frequency
                        )}
                        {item.display_status === "vencida" && (
                          <span className="ml-2 text-red-600 font-medium">(Vencida)</span>
                        )}
                      </p>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Encargado
                        </h4>
                        <p className="text-gray-900">{fullName}</p>
                        {guardian?.email && (
                          <p className="text-gray-600">{guardian.email}</p>
                        )}
                        {guardian?.phone && (
                          <p className="text-gray-600">{guardian.phone}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Monto por {periodLabel}
                          </h4>
                          <p className="text-gray-900 font-medium">
                            {formatCurrency(Number(item.contract.monthly_amount))}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Día de cobro
                          </h4>
                          <p className="text-gray-900">
                            Día {item.contract.billing_day ?? 1} de cada mes
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Periodo de gracia
                          </h4>
                          <p className="text-gray-900">
                            {item.contract.grace_period_days ?? 5} días
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Multa por morosidad
                          </h4>
                          <p className="text-gray-900">
                            {item.contract.penalty_percent ?? 20}%
                          </p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Vigencia del contrato
                        </h4>
                        <p className="text-gray-900">
                          {formatDate(item.contract.start_date)} –{" "}
                          {formatDate(item.contract.end_date)}
                        </p>
                      </div>
                      {item.contract.contract_course_registrations &&
                        item.contract.contract_course_registrations.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                              Matrículas incluidas
                            </h4>
                            <ul className="space-y-0.5">
                              {item.contract.contract_course_registrations.map(
                                (cr: CourseReg) => {
                                  const reg = cr.course_registration;
                                  if (!reg) return null;
                                  const studentName = reg.student
                                    ? `${reg.student.first_name} ${reg.student.last_name}`.trim()
                                    : "—";
                                  const courseLabel = reg.course
                                    ? reg.course.year
                                      ? `${reg.course.name} (${reg.course.year})`
                                      : reg.course.name
                                    : "—";
                                  return (
                                    <li
                                      key={cr.id}
                                      className="text-gray-900"
                                    >
                                      <strong>{studentName}</strong> – {courseLabel}
                                    </li>
                                  );
                                }
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
