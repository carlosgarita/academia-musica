"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

type Period = { id: string; year: number; period: string; academy_id: string };

type Course = {
  id: string;
  period_id: string;
  subject_id: string;
  profile_id: string;
  period?: Period;
  subject?: { id: string; name: string };
  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email?: string;
  };
  sessions_count?: number;
  turnos_count?: number;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodFilter, setPeriodFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    loadCourses();
  }, [periodFilter]);

  async function loadPeriods() {
    try {
      const r = await fetch("/api/periods");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al cargar periodos");
      setPeriods(d.periods || []);
    } catch (e) {
      console.error("loadPeriods", e);
    }
  }

  async function loadCourses() {
    try {
      setLoading(true);
      const url = periodFilter
        ? `/api/courses?period_id=${encodeURIComponent(periodFilter)}`
        : "/api/courses";
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error || d.details || "Error al cargar cursos");
      setCourses(d.courses || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar cursos");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }

  const professorName = (c: Course) =>
    c.profile
      ? [c.profile.first_name, c.profile.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        c.profile.email ||
        "—"
      : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cursos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Crea cursos con sesiones y turnos (materia, profesor, periodo,
            fechas y horarios)
          </p>
        </div>
        <Link
          href="/director/direccion/courses/new"
          className="inline-flex justify-center items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nuevo Curso
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="period" className="text-sm font-medium text-gray-700">
          Periodo
        </label>
        <select
          id="period"
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Todos</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.year} – {p.period}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="text-gray-600">Cargando cursos...</span>
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {periodFilter
              ? "No hay cursos en este periodo."
              : "No hay cursos creados."}
          </p>
          <Link
            href="/director/direccion/courses/new"
            className="mt-4 inline-flex text-indigo-600 hover:text-indigo-500"
          >
            Crear el primer curso
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <ul className="divide-y divide-gray-200">
            {courses.map((c) => (
              <li key={c.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex flex-nowrap items-start sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-medium text-gray-900">
                        {c.subject?.name ?? "—"}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">{professorName(c)}</span>
                      {c.period && (
                        <span className="text-sm text-gray-500">
                          {c.period.year} – {c.period.period}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        {c.sessions_count ?? 0} sesiones
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        {c.turnos_count ?? 0} turnos
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/director/direccion/courses/${c.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            "¿Eliminar este curso? Se borrarán sus sesiones y turnos."
                          )
                        )
                          return;
                        try {
                          const r = await fetch(`/api/courses/${c.id}`, {
                            method: "DELETE",
                          });
                          const d = await r.json();
                          if (!r.ok)
                            throw new Error(
                              d.error || d.details || "Error al eliminar"
                            );
                          loadCourses();
                        } catch (e) {
                          alert(
                            e instanceof Error ? e.message : "Error al eliminar"
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
