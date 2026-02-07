"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Guardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type CourseRegistration = {
  id: string;
  student_id: string;
  student?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  subject?: { id: string; name: string };
  period?: { id: string; year: number; period: string };
  first_session_date?: string | null;
  last_session_date?: string | null;
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatName(first: string | null, last: string | null, email?: string): string {
  const f = first || "";
  const l = last || "";
  if (l && f) return `${l} ${f}`.trim();
  if (l) return l;
  if (f) return f;
  return email || "Sin nombre";
}

export default function NewContractPage() {
  const router = useRouter();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [courseRegistrations, setCourseRegistrations] = useState<CourseRegistration[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingDates, setGeneratingDates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuardians();
  }, []);

  useEffect(() => {
    if (guardianId) {
      loadCourseRegistrations(guardianId);
      setSelectedRegIds(new Set());
    } else {
      setCourseRegistrations([]);
      setSelectedRegIds(new Set());
      setStartDate("");
      setEndDate("");
    }
  }, [guardianId]);

  async function loadGuardians() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/guardians");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar encargados");
      setGuardians(data.guardians || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function loadCourseRegistrations(guardId: string) {
    try {
      const res = await fetch(
        `/api/contracts/guardians/${guardId}/course-registrations`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar matrículas");
      setCourseRegistrations(data.courseRegistrations || []);
      setStartDate("");
      setEndDate("");
    } catch {
      setCourseRegistrations([]);
    }
  }

  function toggleRegistration(id: string) {
    setSelectedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerateDates() {
    const ids = Array.from(selectedRegIds);
    if (ids.length === 0) return;
    setGeneratingDates(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts/date-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_registration_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al generar fechas");
        return;
      }
      if (data.start_date) setStartDate(data.start_date);
      if (data.end_date) setEndDate(data.end_date);
      if (!data.start_date && !data.end_date) {
        setError("No se encontraron fechas de sesiones para los cursos seleccionados. Verifica que existan fechas de tipo \"clase\" en el calendario del periodo.");
      }
    } catch {
      setError("No se pudieron generar las fechas");
    } finally {
      setGeneratingDates(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guardianId || selectedRegIds.size === 0 || !monthlyAmount || !startDate || !endDate) {
      alert("Completa todos los campos requeridos.");
      return;
    }
    const amount = parseFloat(monthlyAmount);
    if (isNaN(amount) || amount < 0) {
      alert("El monto mensual debe ser un número no negativo.");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      alert("Las fechas de inicio y fin no son válidas.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardian_id: guardianId,
          course_registration_ids: Array.from(selectedRegIds),
          monthly_amount: amount,
          start_date: startDate,
          end_date: endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Error al crear contrato");
      router.push(`/director/direccion/contracts/${data.contract.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear contrato");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-600">Cargando encargados...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/director/direccion/contracts"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Contratos
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo contrato</h1>
        <p className="mt-1 text-sm text-gray-500">
          Selecciona un encargado y las matrículas a incluir en el contrato
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Encargado <span className="text-red-500">*</span>
          </label>
          <select
            value={guardianId}
            onChange={(e) => setGuardianId(e.target.value)}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Seleccione un encargado</option>
            {guardians.map((g) => (
              <option key={g.id} value={g.id}>
                {formatName(g.first_name, g.last_name, g.email)}
              </option>
            ))}
            {guardians.length === 0 && (
              <option value="" disabled>
                No hay encargados registrados
              </option>
            )}
          </select>
        </div>

        {guardianId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Matrículas a incluir <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Selecciona las matrículas por las que se cobrará en este contrato
            </p>
            {courseRegistrations.length === 0 ? (
              <p className="text-sm text-amber-600">
                Este encargado no tiene matrículas de sus hijos disponibles.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-md bg-white max-h-48 overflow-y-auto p-3 space-y-2">
                  {courseRegistrations.map((cr) => {
                    const studentName = cr.student
                      ? `${cr.student.first_name} ${cr.student.last_name}`.trim()
                      : "—";
                    const subjectName = cr.subject?.name ?? "—";
                    const periodStr = cr.period
                      ? `${cr.period.year} – ${cr.period.period}`
                      : "—";
                    const firstDate = cr.first_session_date ? formatDate(cr.first_session_date) : null;
                    const lastDate = cr.last_session_date ? formatDate(cr.last_session_date) : null;
                    const sessionRange = firstDate && lastDate ? `${firstDate} – ${lastDate}` : firstDate ?? lastDate ?? null;
                    return (
                      <label
                        key={cr.id}
                        className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRegIds.has(cr.id)}
                          onChange={() => toggleRegistration(cr.id)}
                          className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm">
                            <strong>{studentName}</strong> – {subjectName}{" "}
                            <span className="text-gray-500">({periodStr})</span>
                          </span>
                          {sessionRange && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Sesiones: {sessionRange}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {selectedRegIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleGenerateDates}
                    disabled={generatingDates}
                    className="inline-flex items-center rounded-md bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {generatingDates ? "Generando…" : "Generar fechas de inicio y fin"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Monto mensual (₡) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            required
            placeholder="0.00"
            className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha inicio <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha fin <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving || !guardianId || selectedRegIds.size === 0}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear contrato"}
          </button>
          <Link
            href="/director/direccion/contracts"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
