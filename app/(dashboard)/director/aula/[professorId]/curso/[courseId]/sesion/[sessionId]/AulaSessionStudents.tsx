"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, User } from "lucide-react";

type CourseRegistration = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  student?: { id: string; first_name: string; last_name: string };
  subject?: { id: string; name: string };
  period?: { id: string; year: number; period: string };
  songs_count?: number;
};

export function AulaSessionStudents({
  professorId,
  courseId,
  sessionId,
}: {
  professorId: string;
  courseId: string;
  sessionId: string;
}) {
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(
          `/api/course-registrations?course_id=${encodeURIComponent(courseId)}`
        );
        const d = await r.json();
        if (!r.ok)
          throw new Error(d.error || d.details || "Error al cargar estudiantes");
        setRegistrations(d.courseRegistrations || []);
        setError(null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Error al cargar estudiantes"
        );
        setRegistrations([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const studentName = (r: CourseRegistration) =>
    r.student
      ? [r.student.first_name, r.student.last_name].filter(Boolean).join(" ").trim() || "Sin nombre"
      : "Sin nombre";

  if (loading) {
    return <p className="text-gray-500 text-sm">Cargando estudiantes...</p>;
  }

  if (error) {
    return <p className="text-amber-600 text-sm">{error}</p>;
  }

  if (registrations.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No hay estudiantes matriculados en este curso. Gestiona matrículas en
        Dirección → Matrículas.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {registrations.map((reg) => (
        <li key={reg.id}>
          <Link
            href={`/director/aula/${professorId}/curso/${courseId}/estudiante/${reg.id}`}
            className="flex items-center gap-4 py-4 px-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{studentName(reg)}</p>
                <p className="text-sm text-gray-500">
                  {reg.songs_count ?? 0} canciones asignadas
                </p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-sm text-indigo-600 shrink-0">
              <FileText className="h-4 w-4" />
              Ver expediente
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
