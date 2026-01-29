"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Calendar, Users } from "lucide-react";

type Course = {
  id: string;
  period_id: string;
  subject_id: string;
  profile_id: string;
  period?: { id: string; year: number; period: string; academy_id?: string };
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

export function AulaCourseList({
  professorId,
}: {
  professorId: string;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      // Validar que professorId no esté vacío
      if (!professorId || professorId.trim() === "") {
        setError("ID de profesor inválido");
        setCourses([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const url = `/api/courses?profile_id=${encodeURIComponent(professorId)}`;
        const r = await fetch(url);
        const d = await r.json();
        
        if (!r.ok) {
          throw new Error(d.error || d.details || "Error al cargar cursos");
        }
        
        setCourses(d.courses || []);
        setError(null);
      } catch (e) {
        console.error("Error loading courses:", e);
        setError(e instanceof Error ? e.message : "Error al cargar cursos");
        setCourses([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [professorId]);

  if (loading) {
    return (
      <p className="text-gray-500 text-sm">Cargando cursos...</p>
    );
  }

  if (error) {
    return (
      <p className="text-amber-600 text-sm">{error}</p>
    );
  }

  if (courses.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        Este profesor no tiene cursos asignados. Crea un curso en Dirección →
        Cursos.
      </p>
    );
  }

  const periodLabel = (c: Course) =>
    c.period
      ? `${c.period.year} - Período ${c.period.period}`
      : "—";

  return (
    <ul className="divide-y divide-gray-200">
      {courses.map((course) => (
        <li key={course.id}>
          <Link
            href={`/director/aula/${professorId}/curso/${course.id}`}
            className="flex items-center gap-4 py-4 px-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {course.subject?.name ?? "Sin materia"}
              </p>
              <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                <Calendar className="h-4 w-4 shrink-0" />
                {periodLabel(course)}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500 shrink-0">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {course.sessions_count ?? 0} sesiones
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Ver estudiantes
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
