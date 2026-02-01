"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { FileText, MessageSquare, Save, User, Pencil, Trash2, ClipboardList } from "lucide-react";
import { AulaSongEvaluations } from "./AulaSongEvaluations";
import { AulaBadgeAssignment } from "./AulaBadgeAssignment";

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

const ATTENDANCE_OPTIONS = [
  { value: "", label: "—" },
  { value: "presente", label: "Presente" },
  { value: "ausente", label: "Ausente" },
  { value: "tardanza", label: "Tardanza" },
  { value: "justificado", label: "Justificado" },
] as const;

export function AulaSessionStudents({
  professorId,
  courseId,
  sessionId,
  subjectId,
  academyId,
}: {
  professorId: string;
  courseId: string;
  sessionId: string;
  subjectId: string;
  academyId: string;
}) {
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [attendances, setAttendances] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingCommentFor, setEditingCommentFor] = useState<string | null>(null);
  const [savedCommentIds, setSavedCommentIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [editingAssignmentFor, setEditingAssignmentFor] = useState<string | null>(null);
  const [savedAssignmentIds, setSavedAssignmentIds] = useState<Set<string>>(new Set());
  const [snackbar, setSnackbar] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
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
        const [regRes, attRes, comRes, assRes] = await Promise.all([
          fetch(`/api/course-registrations?course_id=${encodeURIComponent(courseId)}`),
          fetch(`/api/session-attendances?period_date_id=${encodeURIComponent(sessionId)}`),
          fetch(`/api/session-comments?period_date_id=${encodeURIComponent(sessionId)}`),
          fetch(`/api/session-assignments?period_date_id=${encodeURIComponent(sessionId)}`),
        ]);
        const regData = await regRes.json();
        if (!regRes.ok)
          throw new Error(regData.error || regData.details || "Error al cargar estudiantes");
        const regs = regData.courseRegistrations || [];
        regs.sort((a: CourseRegistration, b: CourseRegistration) => {
          const lnA = (a.student?.last_name ?? "").toLowerCase();
          const lnB = (b.student?.last_name ?? "").toLowerCase();
          if (lnA !== lnB) return lnA.localeCompare(lnB);
          const fnA = (a.student?.first_name ?? "").toLowerCase();
          const fnB = (b.student?.first_name ?? "").toLowerCase();
          return fnA.localeCompare(fnB);
        });
        setRegistrations(regs);

        const attData = await attRes.json();
        if (attRes.ok && attData.attendances) {
          const byReg: Record<string, string> = {};
          Object.entries(attData.attendances).forEach(([regId, a]) => {
            const att = a as { attendance_status?: string };
            if (att?.attendance_status) byReg[regId] = att.attendance_status;
          });
          setAttendances(byReg);
        }

        const comData = await comRes.json();
        if (comRes.ok && comData.comments && typeof comData.comments === "object") {
          const byReg: Record<string, string> = {};
          const savedIds = new Set<string>();
          Object.entries(comData.comments).forEach(([regId, val]) => {
            const str = typeof val === "string" ? val : "";
            if (str) {
              byReg[regId] = str;
              savedIds.add(regId);
            }
          });
          setComments(byReg);
          setSavedCommentIds(savedIds);
        }

        const assData = await assRes.json();
        if (assRes.ok && assData.assignments && typeof assData.assignments === "object") {
          const byReg: Record<string, string> = {};
          const savedAssIds = new Set<string>();
          Object.entries(assData.assignments).forEach(([regId, val]) => {
            const str = typeof val === "string" ? val : "";
            if (str) {
              byReg[regId] = str;
              savedAssIds.add(regId);
            }
          });
          setAssignments(byReg);
          setSavedAssignmentIds(savedAssIds);
        }

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
  }, [courseId, sessionId]);

  useEffect(() => {
    return () => {
      if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    };
  }, []);

  const handleSave = async (regId: string) => {
    setSavingId(regId);
    try {
      const attendanceStatus = attendances[regId] ?? "";
      const commentText = (comments[regId] ?? "").trim();
      const assignmentText = (assignments[regId] ?? "").trim();

      // Guardar asistencia
      if (!attendanceStatus) {
        const attDel = await fetch(
          `/api/session-attendances?course_registration_id=${encodeURIComponent(regId)}&period_date_id=${encodeURIComponent(sessionId)}`,
          { method: "DELETE" }
        );
        if (!attDel.ok) {
          const d = await attDel.json();
          throw new Error(d.error || "Error al guardar asistencia");
        }
        setAttendances((prev) => {
          const next = { ...prev };
          delete next[regId];
          return next;
        });
      } else {
        const attRes = await fetch("/api/session-attendances", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_registration_id: regId,
            period_date_id: sessionId,
            attendance_status: attendanceStatus,
          }),
        });
        if (!attRes.ok) {
          const d = await attRes.json();
          throw new Error(d.error || "Error al guardar asistencia");
        }
      }

      // Guardar comentario
      if (!commentText) {
        const comDel = await fetch(
          `/api/session-comments?course_registration_id=${encodeURIComponent(regId)}&period_date_id=${encodeURIComponent(sessionId)}`,
          { method: "DELETE" }
        );
        if (!comDel.ok) {
          const d = await comDel.json();
          throw new Error(d.error || "Error al guardar comentario");
        }
        setComments((prev) => {
          const next = { ...prev };
          delete next[regId];
          return next;
        });
        setSavedCommentIds((prev) => {
          const next = new Set(prev);
          next.delete(regId);
          return next;
        });
      } else {
        const comRes = await fetch("/api/session-comments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_registration_id: regId,
            period_date_id: sessionId,
            comment: commentText,
          }),
        });
        if (!comRes.ok) {
          const d = await comRes.json();
          throw new Error(d.error || "Error al guardar comentario");
        }
        setSavedCommentIds((prev) => new Set(prev).add(regId));
      }

      // Guardar tarea individual
      if (!assignmentText) {
        const assDel = await fetch(
          `/api/session-assignments?course_registration_id=${encodeURIComponent(regId)}&period_date_id=${encodeURIComponent(sessionId)}`,
          { method: "DELETE" }
        );
        if (!assDel.ok) {
          const d = await assDel.json();
          throw new Error(d.error || "Error al guardar tarea");
        }
        setAssignments((prev) => {
          const next = { ...prev };
          delete next[regId];
          return next;
        });
        setSavedAssignmentIds((prev) => {
          const next = new Set(prev);
          next.delete(regId);
          return next;
        });
      } else {
        const assRes = await fetch("/api/session-assignments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_registration_id: regId,
            period_date_id: sessionId,
            assignment_text: assignmentText,
          }),
        });
        if (!assRes.ok) {
          const d = await assRes.json();
          throw new Error(d.error || "Error al guardar tarea");
        }
        setSavedAssignmentIds((prev) => new Set(prev).add(regId));
      }

      setEditingCommentFor((prev) => (prev === regId ? null : prev));
      setEditingAssignmentFor((prev) => (prev === regId ? null : prev));
      showSnackbar("Datos del estudiante guardados");
    } catch (e) {
      console.error("Error saving:", e);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteComment = async (regId: string) => {
    try {
      const r = await fetch(
        `/api/session-comments?course_registration_id=${encodeURIComponent(regId)}&period_date_id=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al eliminar");
      }
      setComments((prev) => {
        const next = { ...prev };
        delete next[regId];
        return next;
      });
      setSavedCommentIds((prev) => {
        const next = new Set(prev);
        next.delete(regId);
        return next;
      });
      setEditingCommentFor((prev) => (prev === regId ? null : prev));
      showSnackbar("Comentario eliminado");
    } catch (e) {
      console.error("Error deleting comment:", e);
    }
  };

  const handleDeleteAssignment = async (regId: string) => {
    try {
      const r = await fetch(
        `/api/session-assignments?course_registration_id=${encodeURIComponent(regId)}&period_date_id=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al eliminar");
      }
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[regId];
        return next;
      });
      setSavedAssignmentIds((prev) => {
        const next = new Set(prev);
        next.delete(regId);
        return next;
      });
      setEditingAssignmentFor((prev) => (prev === regId ? null : prev));
      showSnackbar("Tarea eliminada");
    } catch (e) {
      console.error("Error deleting assignment:", e);
    }
  };

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
    <>
    <ul className="space-y-4">
      {registrations.map((reg) => (
        <li
          key={reg.id}
          className="py-5 px-3 -mx-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300"
        >
          {/* Encabezado: avatar, nombre, expediente */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <p className="font-medium text-gray-900">{studentName(reg)}</p>
            </div>
            <Link
              href={`/director/aula/${professorId}/curso/${courseId}/estudiante/${reg.id}?sesion=${sessionId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <FileText className="h-4 w-4" />
              Expediente
            </Link>
          </div>

          {/* Asistencia */}
          <div className="mt-4 pl-14">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Asistencia</p>
            <select
              value={attendances[reg.id] ?? ""}
              onChange={(e) =>
                setAttendances((prev) => ({ ...prev, [reg.id]: e.target.value }))
              }
              disabled={savingId === reg.id}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-2 py-1.5 border bg-white min-w-[140px]"
            >
              {ATTENDANCE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Comentario del profesor */}
          <div className="mt-4 pl-14">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Comentario del profesor
            </p>
            <div className="mt-0.5">
              {savedCommentIds.has(reg.id) && editingCommentFor !== reg.id ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comments[reg.id]}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCommentFor(reg.id)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteComment(reg.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <textarea
                  placeholder="Escribe un comentario..."
                  value={comments[reg.id] ?? ""}
                  onChange={(e) =>
                    setComments((prev) => ({ ...prev, [reg.id]: e.target.value }))
                  }
                  disabled={savingId === reg.id}
                  rows={2}
                  maxLength={1500}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                />
              )}
            </div>
          </div>

          {/* Tarea individual */}
          <div className="mt-4 pl-14">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Tarea individual
            </p>
            <div className="mt-0.5">
              {savedAssignmentIds.has(reg.id) && editingAssignmentFor !== reg.id ? (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{assignments[reg.id]}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingAssignmentFor(reg.id)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignment(reg.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : (
                <textarea
                  placeholder="Escribe la tarea para esta sesión..."
                  value={assignments[reg.id] ?? ""}
                  onChange={(e) =>
                    setAssignments((prev) => ({ ...prev, [reg.id]: e.target.value }))
                  }
                  disabled={savingId === reg.id}
                  rows={2}
                  maxLength={1500}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                />
              )}
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="mt-4 pl-14">
            <button
              onClick={() => handleSave(reg.id)}
              disabled={savingId === reg.id}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingId === reg.id ? (
                "Guardando..."
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar
                </>
              )}
            </button>
          </div>

          {/* Calificar canciones */}
          <div className="mt-4 pl-14">
            <AulaSongEvaluations
              registrationId={reg.id}
              sessionId={sessionId}
              subjectId={subjectId}
              academyId={academyId}
              onSnackbar={showSnackbar}
            />
          </div>

          {/* Asignar badges */}
          <div className="mt-4 pl-14">
            <AulaBadgeAssignment
              registrationId={reg.id}
              academyId={academyId}
              onSnackbar={showSnackbar}
            />
          </div>
        </li>
      ))}
    </ul>
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
