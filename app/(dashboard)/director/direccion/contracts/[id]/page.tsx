"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, FileText } from "lucide-react";

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
  };
};

type Invoice = {
  id: string;
  month: string;
  amount: number;
  status: "pendiente" | "pagado";
  paid_at: string | null;
};

type Contract = {
  id: string;
  academy_id: string;
  guardian_id: string;
  monthly_amount: number;
  start_date: string;
  end_date: string;
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
  }).format(amount);
}

function getDisplayStatus(invoice: Invoice): "pendiente" | "pagado" | "atrasado" {
  if (invoice.status === "pagado") return "pagado";
  const monthEnd = new Date(invoice.month);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today > monthEnd) return "atrasado";
  return "pendiente";
}

export default function ContractDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

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
      <div className="flex items-center gap-4">
        <Link
          href="/director/direccion/contracts"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Contratos
        </Link>
      </div>

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
            <h2 className="text-sm font-medium text-gray-500">Monto mensual</h2>
            <p className="mt-1 text-lg font-medium text-gray-900">
              {formatCurrency(Number(contract.monthly_amount))}
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
                  const subjectName = reg.subject?.name ?? "—";
                  const periodStr = reg.period
                    ? `${reg.period.year} – ${reg.period.period}`
                    : "—";
                  return (
                    <li key={cr.id} className="text-sm text-gray-900">
                      <strong>{studentName}</strong> – {subjectName}{" "}
                      <span className="text-gray-500">({periodStr})</span>
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
          <h2 className="text-lg font-medium text-gray-900">Facturas mensuales</h2>
          <p className="mt-1 text-sm text-gray-500">
            El director puede cambiar el estado de Pendiente a Pagado y registrar la fecha de pago
          </p>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {invoices.map((inv) => {
              const displayStatus = getDisplayStatus(inv);
              return (
                <li
                  key={inv.id}
                  className="px-4 py-4 sm:px-6 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatMonth(inv.month)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(Number(inv.amount))}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        displayStatus === "pagado"
                          ? "bg-green-100 text-green-800"
                          : displayStatus === "atrasado"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {displayStatus === "pagado"
                        ? "Pagado"
                        : displayStatus === "atrasado"
                          ? "Atrasado"
                          : "Pendiente"}
                    </span>
                    {displayStatus !== "pagado" && (
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
