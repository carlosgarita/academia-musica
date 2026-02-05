"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  Award,
  ClipboardList,
  Music,
  ArrowLeft,
  Users,
  CheckCircle2,
  Circle,
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
    evaluations: {
      id: string;
      dateFormatted: string;
      songName: string;
      rubricName: string;
      scaleName: string;
    }[];
    comments: { id: string; dateFormatted: string; comment: string }[];
    assignments: {
      id: string;
      dateFormatted: string;
      assignmentText: string;
      isCompleted?: boolean;
    }[];
    groupAssignments: {
      id: string;
      date?: string;
      dateFormatted: string;
      assignmentText: string;
      isGroup: true;
      isCompleted?: boolean;
    }[];
    badges: {
      id: string;
      badgeId: string;
      name: string;
      virtud?: string | null;
      description?: string | null;
      frase?: string | null;
      imageUrl?: string | null;
      dateFormatted: string;
    }[];
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });
  const snackbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSnackbar = (message: string) => {
    if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    setSnackbar({ show: true, message });
    snackbarTimeoutRef.current = setTimeout(() => {
      setSnackbar((s) => ({ ...s, show: false }));
      snackbarTimeoutRef.current = null;
    }, 3000);
  };

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
        const r = await fetch(
          `/api/course-registrations/${registrationId}/expediente-history`
        );
        const d = await r.json();
        if (r.ok && d) {
          setHistory({
            evaluations: d.evaluations || [],
            comments: d.comments || [],
            assignments: d.assignments || [],
            groupAssignments: d.groupAssignments || [],
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

  useEffect(
    () => () => {
      if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    },
    []
  );

  const studentId = data?.student_id ?? data?.student?.id ?? null;

  const handleToggleTask = async (
    taskId: string,
    isGroup: boolean,
    currentlyCompleted: boolean
  ) => {
    if (!studentId) return;
    setTogglingTaskId(taskId);
    try {
      if (currentlyCompleted) {
        const params = isGroup
          ? `session_group_assignment_id=${taskId}&student_id=${studentId}`
          : `session_assignment_id=${taskId}&student_id=${studentId}`;
        const res = await fetch(`/api/task-completions?${params}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al desmarcar tarea");
        }
        setHistory((prev) =>
          prev
            ? {
                ...prev,
                assignments: prev.assignments.map((a) =>
                  !isGroup && a.id === taskId ? { ...a, isCompleted: false } : a
                ),
                groupAssignments: prev.groupAssignments.map((g) =>
                  isGroup && g.id === taskId ? { ...g, isCompleted: false } : g
                ),
              }
            : prev
        );
        showSnackbar("Tarea desmarcada");
      } else {
        const body = isGroup
          ? { session_group_assignment_id: taskId, student_id: studentId }
          : { session_assignment_id: taskId, student_id: studentId };
        const res = await fetch("/api/task-completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Error al marcar tarea");
        }
        setHistory((prev) =>
          prev
            ? {
                ...prev,
                assignments: prev.assignments.map((a) =>
                  !isGroup && a.id === taskId ? { ...a, isCompleted: true } : a
                ),
                groupAssignments: prev.groupAssignments.map((g) =>
                  isGroup && g.id === taskId ? { ...g, isCompleted: true } : g
                ),
              }
            : prev
        );
        showSnackbar("Tarea marcada como completada");
      }
    } catch (e) {
      console.error("Error toggling task:", e);
      showSnackbar(
        e instanceof Error ? e.message : "Error al actualizar tarea"
      );
    } finally {
      setTogglingTaskId(null);
    }
  };

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
        <p className="text-amber-600 text-sm">
          {error ?? "Expediente no encontrado"}
        </p>
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
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
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
                  <span className="font-medium">{e.songName}</span> —{" "}
                  {e.rubricName}:{" "}
                  <span className="text-indigo-600">{e.scaleName}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No hay calificaciones registradas.
          </p>
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
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {c.comment}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No hay comentarios registrados.
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gray-500" />
          Tareas individuales
        </h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : history?.assignments && history.assignments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {history.assignments.map((a) => (
              <li
                key={a.id}
                className={`py-3 flex items-start gap-3 rounded ${
                  a.isCompleted ? "bg-green-50 px-3" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleTask(a.id, false, !!a.isCompleted)}
                  disabled={togglingTaskId === a.id || !studentId}
                  className="mt-0.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    a.isCompleted
                      ? "Desmarcar como completada"
                      : "Marcar como completada"
                  }
                >
                  {a.isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400 hover:text-indigo-500" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-500">{a.dateFormatted}</p>
                    {a.isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Hecha
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${
                      a.isCompleted
                        ? "text-gray-600 line-through"
                        : "text-gray-700"
                    }`}
                  >
                    {a.assignmentText}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No hay tareas individuales registradas.
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-500" />
          Tareas grupales
        </h2>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : history?.groupAssignments && history.groupAssignments.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {history.groupAssignments.map((g) => (
              <li
                key={g.id}
                className={`py-3 flex items-start gap-3 rounded ${
                  g.isCompleted ? "bg-green-50 px-3" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleTask(g.id, true, !!g.isCompleted)}
                  disabled={togglingTaskId === g.id || !studentId}
                  className="mt-0.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    g.isCompleted
                      ? "Desmarcar como completada"
                      : "Marcar como completada"
                  }
                >
                  {g.isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400 hover:text-indigo-500" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-gray-500">{g.dateFormatted}</p>
                    {g.isCompleted && (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        Hecha
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm whitespace-pre-wrap ${
                      g.isCompleted
                        ? "text-gray-600 line-through"
                        : "text-gray-700"
                    }`}
                  >
                    {g.assignmentText}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No hay tareas grupales registradas.
          </p>
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
                  <img
                    src={b.imageUrl}
                    alt={b.name}
                    className="h-10 w-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center shrink-0">
                    <Award className="h-5 w-5 text-gray-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">
                    {b.dateFormatted}
                  </p>
                  <p className="font-medium text-gray-900 text-sm">{b.name}</p>
                  {b.virtud && (
                    <p className="text-xs text-indigo-600 font-medium">
                      {b.virtud}
                    </p>
                  )}
                  {b.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {b.description}
                    </p>
                  )}
                  {b.frase && (
                    <p className="text-xs text-gray-600 italic mt-1">
                      &quot;{b.frase}&quot;
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            No hay badges registrados en este curso.
          </p>
        )}
      </div>

      {snackbar.show && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm shadow-lg"
        >
          {snackbar.message}
        </div>
      )}
    </div>
  );
}
