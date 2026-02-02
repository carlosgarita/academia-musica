"use client";

import { useEffect, useState, useRef } from "react";
import {
  Music,
  MessageSquare,
  ClipboardList,
  Award,
  CheckCircle2,
  Circle,
  Users,
} from "lucide-react";

type Evaluation = {
  id: string;
  date: string;
  dateFormatted: string;
  songName: string;
  rubricName: string;
  scaleName: string;
  scaleValue: number | null;
};

type Comment = {
  id: string;
  date: string;
  dateFormatted: string;
  comment: string;
};

type Assignment = {
  id: string;
  date: string;
  dateFormatted: string;
  assignmentText: string;
  isCompleted: boolean;
};

type GroupAssignment = {
  id: string;
  date: string;
  dateFormatted: string;
  assignmentText: string;
  isGroup: true;
  isCompleted: boolean;
};

type Badge = {
  id: string;
  badgeId: string;
  name: string;
  virtud?: string | null;
  description?: string | null;
  frase?: string | null;
  imageUrl?: string | null;
  dateFormatted: string;
};

type ProgressData = {
  registration: {
    id: string;
    subject: { id: string; name: string } | null;
    period: { id: string; year: number; period: string } | null;
    status: string | null;
  };
  evaluations: Evaluation[];
  comments: Comment[];
  assignments: Assignment[];
  groupAssignments: GroupAssignment[];
  badges: Badge[];
};

export function HogarCourseProgress({
  studentId,
  registrationId,
  guardianId,
}: {
  studentId: string;
  registrationId: string;
  guardianId?: string;
}) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setLoading(true);
      setError(null);
      try {
        const url = guardianId
          ? `/api/guardian/students/${studentId}/courses/${registrationId}/progress?guardian_id=${guardianId}`
          : `/api/guardian/students/${studentId}/courses/${registrationId}/progress`;
        const res = await fetch(url);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al cargar progreso");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar progreso");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId, registrationId, guardianId]);

  useEffect(
    () => () => {
      if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    },
    []
  );

  const handleToggleTask = async (
    taskId: string,
    isGroup: boolean,
    currentlyCompleted: boolean
  ) => {
    setTogglingTaskId(taskId);
    try {
      if (currentlyCompleted) {
        // Unmark as completed
        const params = isGroup
          ? `session_group_assignment_id=${taskId}&student_id=${studentId}`
          : `session_assignment_id=${taskId}&student_id=${studentId}`;
        const res = await fetch(`/api/task-completions?${params}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Error al desmarcar tarea");
        }
        // Update local state
        if (isGroup) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  groupAssignments: prev.groupAssignments.map((a) =>
                    a.id === taskId ? { ...a, isCompleted: false } : a
                  ),
                }
              : prev
          );
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  assignments: prev.assignments.map((a) =>
                    a.id === taskId ? { ...a, isCompleted: false } : a
                  ),
                }
              : prev
          );
        }
        showSnackbar("Tarea desmarcada");
      } else {
        // Mark as completed
        const body = isGroup
          ? { session_group_assignment_id: taskId, student_id: studentId }
          : { session_assignment_id: taskId, student_id: studentId };
        const res = await fetch("/api/task-completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Error al marcar tarea");
        }
        // Update local state
        if (isGroup) {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  groupAssignments: prev.groupAssignments.map((a) =>
                    a.id === taskId ? { ...a, isCompleted: true } : a
                  ),
                }
              : prev
          );
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  assignments: prev.assignments.map((a) =>
                    a.id === taskId ? { ...a, isCompleted: true } : a
                  ),
                }
              : prev
          );
        }
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
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-amber-600 text-sm">{error}</p>;
  }

  if (!data) {
    return <p className="text-gray-500 text-sm">No hay datos disponibles.</p>;
  }

  const { evaluations, comments, assignments, groupAssignments, badges } = data;

  // Combine individual and group assignments for display
  const allTasks = [
    ...assignments.map((a) => ({ ...a, isGroup: false as const })),
    ...groupAssignments,
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <>
      <div className="space-y-6">
        {/* Evaluaciones */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Music className="h-4 w-4 text-gray-500" />
            Evaluaciones de canciones
          </h4>
          {evaluations.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No hay evaluaciones registradas.
            </p>
          ) : (
            <ul className="space-y-2">
              {evaluations.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-gray-900">{e.songName}</p>
                    <p className="text-xs text-gray-500">
                      {e.rubricName} • {e.dateFormatted}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-medium px-2 py-0.5 rounded ${
                      e.scaleValue !== null && e.scaleValue >= 4
                        ? "bg-green-100 text-green-800"
                        : e.scaleValue !== null && e.scaleValue >= 3
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {e.scaleName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Comentarios del profesor */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-500" />
            Comentarios del profesor
          </h4>
          {comments.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay comentarios.</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <p className="text-xs text-gray-500 mb-1">
                    {c.dateFormatted}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {c.comment}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Tareas */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-gray-500" />
            Tareas
          </h4>
          {allTasks.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay tareas asignadas.</p>
          ) : (
            <ul className="space-y-2">
              {allTasks.map((task) => (
                <li
                  key={`${task.isGroup ? "g" : "i"}-${task.id}`}
                  className={`rounded-lg border px-3 py-2 ${
                    task.isCompleted
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleTask(
                          task.id,
                          task.isGroup,
                          task.isCompleted
                        )
                      }
                      disabled={togglingTaskId === task.id}
                      className="mt-0.5 flex-shrink-0 disabled:opacity-50"
                      title={
                        task.isCompleted
                          ? "Desmarcar como completada"
                          : "Marcar como completada"
                      }
                    >
                      {task.isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400 hover:text-indigo-500" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-gray-500">
                          {task.dateFormatted}
                        </p>
                        {task.isGroup && (
                          <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">
                            <Users className="h-3 w-3" />
                            Grupal
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-sm whitespace-pre-wrap ${
                          task.isCompleted
                            ? "text-gray-500 line-through"
                            : "text-gray-700"
                        }`}
                      >
                        {task.assignmentText}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Badges */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Award className="h-4 w-4 text-gray-500" />
            Insignias ganadas
          </h4>
          {badges.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No hay insignias ganadas en este curso.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center text-center rounded-lg border border-gray-200 bg-white p-3"
                >
                  {badge.imageUrl ? (
                    <img
                      src={badge.imageUrl}
                      alt={badge.name}
                      className="h-12 w-12 object-contain mb-2"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                      <Award className="h-6 w-6 text-amber-600" />
                    </div>
                  )}
                  <p className="font-medium text-sm text-gray-900">
                    {badge.name}
                  </p>
                  {badge.virtud && (
                    <p className="text-xs text-indigo-600">{badge.virtud}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {badge.dateFormatted}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
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
    </>
  );
}
