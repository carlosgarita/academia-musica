"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Users } from "lucide-react";

type Session = {
  id: string;
  date: string;
  date_type?: string;
  comment?: string | null;
};

export function AulaSessionList({
  professorId,
  courseId,
  courseName,
  pathPrefix,
}: {
  professorId: string;
  courseId: string;
  courseName: string;
  pathPrefix: "director" | "professor";
}) {
  const base = `/${pathPrefix}/aula/${professorId}/curso/${courseId}`;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/courses/${courseId}/sessions`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.details || "Error al cargar sesiones");
        setSessions(d.sessions || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar sesiones");
        setSessions([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [courseId]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + "T12:00:00").toLocaleDateString("es-CR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) return <p className="text-gray-500 text-sm">Cargando sesiones...</p>;
  if (error) return <p className="text-amber-600 text-sm">{error}</p>;
  if (sessions.length === 0) {
    return (
      <p className="text-gray-500 text-sm">
        No hay sesiones de clase registradas para este curso. Configura las fechas en Dirección → Cursos.
      </p>
    );
  }

  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <ul className="divide-y divide-gray-200">
      {sortedSessions.map((session, i) => (
        <li key={session.id}>
          <Link
            href={`${base}/sesion/${session.id}`}
            className="flex items-center gap-4 py-4 px-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0 text-gray-500" />
                Sesión {i + 1} – {formatDate(session.date)}
              </p>
              {session.comment && (
                <p className="text-sm text-gray-500 mt-0.5 truncate max-w-md">{session.comment}</p>
              )}
            </div>
            <span className="flex items-center gap-1 text-sm text-gray-500 shrink-0">
              <Users className="h-4 w-4" />
              Ver estudiantes
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
