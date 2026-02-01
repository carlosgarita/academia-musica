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
  academy_id?: string;
  student?: { id: string; first_name: string; last_name: string };
  subject?: { id: string; name: string };
  period?: { id: string; year: number; period: string };
  songs: Song[];
};

export function ExpedienteContent({
  registrationId,
  courseId,
  professorId,
  sessionId,
  pathPrefix,
}: {
  registrationId: string;
  courseId: string;
  professorId: string;
  sessionId?: string | null;
  pathPrefix: "director" | "professor";
}) {
  const base = `/${pathPrefix}/aula/${professorId}/curso/${courseId}`;
  const [data, setData] = useState<CourseRegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{
    evaluations: { id: string; dateFormatted: string; songName: string; rubricName: string; scaleName: string }[];
    comments: { id: string; dateFormatted: string; comment: string }[];
    assignments: { id: string; dateFormatted: string; assignmentText: string }[];
    badges: { id: string; badgeId: string; name: string; virtud?: string | null; description?: string | null; frase?: string | null; imageUrl?: string | null; dateFormatted: string }[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  useEffect(() => {
    if (!registrationId) return;
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const r = await fetch(`/api/course-registrations/${registrationId}/expediente-history`);
        const d = await r.json();
        if (r.ok && d) {
          setHistory({
            evaluations: d.evaluations || [],
            comments: d.comments || [],
            assignments: d.assignments || [],
            badges: d.badges || [],
          });
        }
      } catch (e) {
        console.error("Error loading expediente history:", e);
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
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
          href={sessionId ? `${base}/sesion/${sessionId}` : base}
          className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {sessionId ? "Volver a la sesión" : "Volver al curso"}
        </Link>
      </div>
    );
  }

  const backHref = sessionId ? `${base}/sesion/${sessionId}` : base;
  const backLabel = sessionId ? "Volver a la sesión" : "Volver al curso";

  return (
    <div className="space-y-6">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-gray-500" />
          Canciones asignadas
        </h2>
        {data.songs && data.songs.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {data.songs.map((song) => (
              <li key={song.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{song.name}</p>
                  {song.author && <p className="text-sm text-gray-500">{song.author}</p>}
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
          <p className="text-gray-500 text-sm">No hay canciones asignadas. Asigna canciones desde Dirección → Matrículas.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-500" />
          Calificaciones por sesión
        </h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : history?.evaluations && history.evaluations.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {history.evaluations.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-xs text-gray-500 mb-1">{e.dateFormatted}</p>
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{e.songName}</span> — {e.rubricName}: <span className="text-indigo-600">{e.scaleName}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No hay calificaciones registradas.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          Comentarios del profesor
        </h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : history?.comments && history.comments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {history.comments.map((c) => (
              <li key={c.id} className="py-3">
                <p className="text-xs text-gray-500 mb-1">{c.dateFormatted}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No hay comentarios registrados.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gray-500" />
          Tareas
        </h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : history?.assignments && history.assignments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {history.assignments.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-xs text-gray-500 mb-1">{a.dateFormatted}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.assignmentText}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No hay tareas registradas.</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-gray-500" />
          Historial de badges
        </h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : history?.badges && history.badges.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {history.badges.map((b) => (
              <li key={b.id} className="py-3 flex items-start gap-3">
                {b.imageUrl?.startsWith("http") ? (
                  <img src={b.imageUrl} alt={b.name} className="h-10 w-10 rounded object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center shrink-0">
                    <Award className="h-5 w-5 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">{b.dateFormatted}</p>
                  <p className="font-medium text-gray-900 text-sm">{b.name}</p>
                  {b.virtud && <p className="text-xs text-indigo-600 font-medium">{b.virtud}</p>}
                  {b.description && <p className="text-xs text-gray-500 mt-1">{b.description}</p>}
                  {b.frase && <p className="text-xs text-gray-600 italic mt-1">"{b.frase}"</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No hay badges registrados en este curso.</p>
        )}
      </div>
    </div>
  );
}
