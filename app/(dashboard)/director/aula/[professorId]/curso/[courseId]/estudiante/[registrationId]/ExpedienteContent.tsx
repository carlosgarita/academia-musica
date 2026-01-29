"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  Award,
  ClipboardList,
  Music,
  ArrowLeft,
} from "lucide-react";

type Song = {
  id: string;
  name: string;
  author?: string | null;
  difficulty_level?: string | null;
};

type CourseRegistrationData = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  student?: { id: string; first_name: string; last_name: string };
  subject?: { id: string; name: string };
  period?: { id: string; year: number; period: string };
  songs: Song[];
};

export function ExpedienteContent({
  registrationId,
  courseId,
  professorId,
}: {
  registrationId: string;
  courseId: string;
  professorId: string;
}) {
  const [data, setData] = useState<CourseRegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/course-registrations/${registrationId}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error al cargar expediente");
        setData(d.courseRegistration || null);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar expediente");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [registrationId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-sm">Cargando expediente...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-amber-600 text-sm">{error ?? "Expediente no encontrado"}</p>
        <Link
          href={`/director/aula/${professorId}/curso/${courseId}`}
          className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al curso
        </Link>
      </div>
    );
  }

  const periodLabel = data.period
    ? `${data.period.year} - Período ${data.period.period}`
    : "";

  return (
    <div className="space-y-6">
      <Link
        href={`/director/aula/${professorId}/curso/${courseId}`}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al curso
      </Link>

      {/* Canciones asignadas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-gray-500" />
          Canciones asignadas
        </h2>
        {data.songs && data.songs.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {data.songs.map((song) => (
              <li
                key={song.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{song.name}</p>
                  {song.author && (
                    <p className="text-sm text-gray-500">{song.author}</p>
                  )}
                </div>
                {song.difficulty_level && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 shrink-0">
                    {song.difficulty_level}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">
            No hay canciones asignadas. Asigna canciones desde Dirección →
            Matrículas.
          </p>
        )}
      </div>

      {/* Calificaciones (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-500" />
          Calificaciones por sesión
        </h2>
        <p className="text-sm text-gray-500">
          Las calificaciones por rubro y sesión se mostrarán aquí cuando estén
          disponibles.
        </p>
      </div>

      {/* Comentarios del profesor (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          Comentarios del profesor
        </h2>
        <p className="text-sm text-gray-500">
          Los comentarios por sesión se mostrarán aquí.
        </p>
      </div>

      {/* Tareas (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gray-500" />
          Tareas
        </h2>
        <p className="text-sm text-gray-500">
          Tareas individuales y grupales del curso.
        </p>
      </div>

      {/* Badges (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Award className="h-5 w-5 text-gray-500" />
          Badges
        </h2>
        <p className="text-sm text-gray-500">
          Los badges asignados al estudiante en este curso se mostrarán aquí.
        </p>
      </div>
    </div>
  );
}
