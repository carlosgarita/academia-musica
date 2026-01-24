"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type CourseRegistration = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  status: string;
  enrollment_date: string;
  created_at: string;
  student: { id: string; first_name: string; last_name: string } | null;
  subject: { id: string; name: string } | null;
  period: { id: string; year: number; period: string } | null;
  songs_count: number;
};

type Schedule = { id: string; subject_id: string | null; day_of_week: number; start_time: string; end_time: string };

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

type Group = { subject_id: string; period_id: string; subject: { id: string; name: string } | null; period: { id: string; year: number; period: string } | null };

export default function CourseRegistrationsPage() {
  const [list, setList] = useState<CourseRegistration[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const [regRes, schedRes] = await Promise.all([
        fetch("/api/course-registrations"),
        fetch("/api/schedules"),
      ]);
      const regData = await regRes.json();
      const schedData = await schedRes.json();
      if (!regRes.ok) throw new Error(regData.error || "Error al cargar matrículas");
      setList(regData.courseRegistrations || []);
      setSchedules(schedData.schedules || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  // Agrupar por (subject_id, period_id); cada grupo = una fila: clase, periodo, horario
  const groups: Group[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const key = `${r.subject_id}-${r.period_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({
      subject_id: r.subject_id,
      period_id: r.period_id,
      subject: r.subject,
      period: r.period,
    });
  }
  // Ordenar por nombre de clase y luego periodo
  groups.sort((a, b) => {
    const na = a.subject?.name || "";
    const nb = b.subject?.name || "";
    if (na !== nb) return na.localeCompare(nb);
    const pa = a.period ? `${a.period.year}-${a.period.period}` : "";
    const pb = b.period ? `${b.period.year}-${b.period.period}` : "";
    return pa.localeCompare(pb);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando matrículas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Clases por periodo y horario; editar para ver estudiantes matriculados
          </p>
        </div>
        <Link
          href="/director/direccion/course-registrations/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nueva matrícula
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay matrículas.</p>
          <Link
            href="/director/direccion/course-registrations/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear la primera matrícula
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {groups.map((g) => {
              const cl = g.subject?.name || "—";
              const pd = g.period ? `${g.period.year}-${g.period.period}` : "—";
              const horario = formatHorario(schedules, g.subject_id);
              return (
                <li key={`${g.subject_id}-${g.period_id}`} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{cl}</h3>
                      <p className="text-sm text-gray-600">Periodo: {pd}</p>
                      <p className="mt-1 text-sm text-gray-500">Horario: {horario}</p>
                    </div>
                    <Link
                      href={`/director/direccion/course-registrations/class/${g.subject_id}/${g.period_id}`}
                      className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                    >
                      Editar
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
