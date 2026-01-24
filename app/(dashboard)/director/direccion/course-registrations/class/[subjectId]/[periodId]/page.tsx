"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type Schedule = { id: string; subject_id: string | null; day_of_week: number; start_time: string; end_time: string };

type Reg = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  student: { id: string; first_name: string; last_name: string } | null;
  subject: { id: string; name: string } | null;
  period: { id: string; year: number; period: string } | null;
};

function formatHorario(schedules: Schedule[], subjectId: string): string {
  const forSubject = (schedules || []).filter((s) => s.subject_id === subjectId);
  if (forSubject.length === 0) return "Sin horario";
  return forSubject
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
    .map((s) => {
      const day = DAY_NAMES[s.day_of_week - 1] || `Día ${s.day_of_week}`;
      const start = String(s.start_time).slice(0, 5);
      const end = String(s.end_time).slice(0, 5);
      return `${day} ${start}-${end}`;
    })
    .join(", ");
}

export default function ClassCourseRegistrationsPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;
  const periodId = params.periodId as string;

  const [regs, setRegs] = useState<Reg[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState<{ id: string; name: string } | null>(null);
  const [period, setPeriod] = useState<{ id: string; year: number; period: string } | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [regRes, schedRes, subjRes, perRes] = await Promise.all([
        fetch(`/api/course-registrations?subject_id=${subjectId}&period_id=${periodId}`),
        fetch("/api/schedules"),
        fetch("/api/subjects"),
        fetch("/api/periods"),
      ]);
      const regData = await regRes.json();
      const schedData = await schedRes.json();
      const subjData = await subjRes.json();
      const perData = await perRes.json();
      if (!regRes.ok) throw new Error(regData.error || "Error al cargar");
      setRegs(regData.courseRegistrations || []);
      setSchedules(schedData.schedules || []);
      const s = (subjData.subjects || []).find((x: { id: string }) => x.id === subjectId);
      setSubject(s ? { id: s.id, name: s.name } : null);
      const p = (perData.periods || []).find((x: { id: string }) => x.id === periodId);
      setPeriod(p ? { id: p.id, year: p.year, period: p.period } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [subjectId, periodId]);

  async function handleRemove(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name} de esta clase?`)) return;
    try {
      const res = await fetch(`/api/course-registrations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al eliminar");
      }
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  const horario = formatHorario(schedules, subjectId);
  const cl = subject?.name || "—";
  const pd = period ? `${period.year}-${period.period}` : "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Clase: {cl}</h1>
        <p className="mt-1 text-sm text-gray-500">Periodo: {pd} · Horario: {horario}</p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Estudiantes matriculados</h2>

        {regs.length === 0 ? (
          <p className="text-sm text-gray-500">No hay estudiantes matriculados en esta clase y periodo.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {regs.map((r) => {
              const sn = r.student ? `${r.student.first_name} ${r.student.last_name}`.trim() || "—" : "—";
              return (
                <li key={r.id} className="py-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-900">{sn}</span>
                  <div className="flex gap-2">
                    <Link
                      href={`/director/direccion/course-registrations/${r.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemove(r.id, sn)}
                      className="text-red-600 hover:text-red-900 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

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
