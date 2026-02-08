"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function EditCourseRegistrationPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reg, setReg] = useState<{
    id: string;
    student_id: string;
    subject_id: string;
    period_id: string;
    status: string;
    student?: { first_name: string; last_name: string } | null;
    subject?: { name: string } | null;
    period?: { year: number; period: string } | null;
  } | null>(null);
  const [status, setStatus] = useState("active");

  useEffect(() => {
    (async () => {
      try {
        const rRes = await fetch(`/api/course-registrations/${id}`);
        const rData = await rRes.json();
        if (!rRes.ok)
          throw new Error(rData.error || "No se encontró la matrícula");
        setReg(rData.courseRegistration);
        setStatus(rData.courseRegistration?.status || "active");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/course-registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al actualizar");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando…</div>
      </div>
    );
  }

  if (error && !reg) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <Link
          href="/director/direccion/course-registrations"
          className="text-indigo-600 hover:text-indigo-900"
        >
          Volver a matrículas
        </Link>
      </div>
    );
  }

  if (!reg) return null;

  const sn = reg.student
    ? `${reg.student.first_name} ${reg.student.last_name}`.trim()
    : "—";
  const cl = reg.subject?.name || "—";
  const pd = reg.period ? `${reg.period.year}-${reg.period.period}` : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar Estado</h1>
        <p className="mt-1 text-sm text-gray-500">
          {sn} · {cl} · {pd}
        </p>
      </div>

      <form
        onSubmit={handleStatusSubmit}
        className="bg-white shadow rounded-lg p-6"
      >
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Estado de la matrícula
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="active">Activa</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar estado"}
          </button>
        </div>
      </form>

      <div>
        <Link
          href="/director/direccion/course-registrations"
          className="text-indigo-600 hover:text-indigo-900 text-sm"
        >
          ← Volver a matrículas
        </Link>
      </div>
    </div>
  );
}
