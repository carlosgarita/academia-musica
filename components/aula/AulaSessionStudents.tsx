"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  MessageSquare,
  Save,
  User,
  Pencil,
  Trash2,
  ClipboardList,
  Users,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
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
  pathPrefix,
}: {
  professorId: string;
  courseId: string;
  sessionId: string;
  subjectId: string;
  academyId: string;
  pathPrefix: "director" | "professor";
}) {
  const base = `/${pathPrefix}/aula/${professorId}/curso/${courseId}`;
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [attendances, setAttendances] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAttendanceId, setSavingAttendanceId] = useState<string | null>(
    null
  );
  const [expandedRegIds, setExpandedRegIds] = useState<Set<string>>(new Set());
  const [editingCommentFor, setEditingCommentFor] = useState<string | null>(
    null
  );
  const [savedCommentIds, setSavedCommentIds] = useState<Set<string>>(
    new Set()
  );
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [assignmentIdByRegId, setAssignmentIdByRegId] = useState<
    Record<string, string>
  >({});
  const [editingAssignmentFor, setEditingAssignmentFor] = useState<
    string | null
  >(null);
  const [savedAssignmentIds, setSavedAssignmentIds] = useState<Set<string>>(
    new Set()
  );
  const [groupAssignmentText, setGroupAssignmentText] = useState("");
  const [groupAssignmentSaved, setGroupAssignmentSaved] = useState(false);
  const [editingGroupAssignment, setEditingGroupAssignment] = useState(false);
  const [savingGroupAssignment, setSavingGroupAssignment] = useState(false);
  const [deletingGroupAssignment, setDeletingGroupAssignment] = useState(false);
  const [deletingCommentFor, setDeletingCommentFor] = useState<string | null>(
    null
  );
  const [deletingAssignmentFor, setDeletingAssignmentFor] = useState<
    string | null
  >(null);
  // Task completion states - which tasks the guardian marked as done
  const [taskCompletions, setTaskCompletions] = useState<{
    byAssignmentId: Set<string>;
    byGroupAssignmentId: Set<string>;
  }>({ byAssignmentId: new Set(), byGroupAssignmentId: new Set() });
  const [groupAssignmentId, setGroupAssignmentId] = useState<string | null>(
    null
  );
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
        const [regRes, attRes, comRes, assRes, groupAssRes] = await Promise.all(
          [
            fetch(
              `/api/course-registrations?course_id=${encodeURIComponent(
                courseId
              )}`
            ),
            fetch(
              `/api/session-attendances?period_date_id=${encodeURIComponent(
                sessionId
              )}`
            ),
            fetch(
              `/api/session-comments?period_date_id=${encodeURIComponent(
                sessionId
              )}`
            ),
            fetch(
              `/api/session-assignments?period_date_id=${encodeURIComponent(
                sessionId
              )}`
            ),
            fetch(
              `/api/session-group-assignments?period_date_id=${encodeURIComponent(
                sessionId
              )}`
            ),
          ]
        );
        const regData = await regRes.json();
        if (!regRes.ok)
          throw new Error(
            regData.error || regData.details || "Error al cargar estudiantes"
          );
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
        if (
          comRes.ok &&
          comData.comments &&
          typeof comData.comments === "object"
        ) {
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
        if (
          assRes.ok &&
          assData.assignments &&
          typeof assData.assignments === "object"
        ) {
          const byReg: Record<string, string> = {};
          const savedAssIds = new Set<string>();
          const idByReg: Record<string, string> = {};
          Object.entries(assData.assignments).forEach(([regId, val]) => {
            const str = typeof val === "string" ? val : "";
            if (str) {
              byReg[regId] = str;
              savedAssIds.add(regId);
            }
          });
          // Store assignment IDs for completion checking
          if (assData.assignmentDetails) {
            Object.entries(assData.assignmentDetails).forEach(
              ([regId, detail]) => {
                const d = detail as { id: string; text: string };
                if (d?.id) {
                  idByReg[regId] = d.id;
                }
              }
            );
          }
          setAssignments(byReg);
          setSavedAssignmentIds(savedAssIds);
          setAssignmentIdByRegId(idByReg);
        }

        const groupAssData = await groupAssRes.json();
        if (groupAssRes.ok && groupAssData.groupAssignment) {
          setGroupAssignmentText(
            groupAssData.groupAssignment.assignment_text ?? ""
          );
          setGroupAssignmentId(groupAssData.groupAssignment.id ?? null);
          setGroupAssignmentSaved(true);
          setEditingGroupAssignment(false);
        } else {
          setGroupAssignmentText("");
          setGroupAssignmentId(null);
          setGroupAssignmentSaved(false);
          setEditingGroupAssignment(false);
        }

        // Load task completions for all students
        const studentIds = regs
          .map((r: CourseRegistration) => r.student?.id)
          .filter(Boolean) as string[];
        const completedAssignmentIds = new Set<string>();
        const completedGroupAssignmentIds = new Set<string>();

        for (const studentId of studentIds) {
          try {
            const tcRes = await fetch(
              `/api/task-completions?student_id=${encodeURIComponent(
                studentId
              )}`
            );
            if (tcRes.ok) {
              const tcData = await tcRes.json();
              (tcData.completions || []).forEach((c: any) => {
                if (c.session_assignment_id) {
                  completedAssignmentIds.add(c.session_assignment_id);
                }
                if (c.session_group_assignment_id) {
                  completedGroupAssignmentIds.add(
                    `${c.session_group_assignment_id}-${studentId}`
                  );
                }
              });
            }
          } catch (e) {
            console.error(
              "Error loading task completions for student:",
              studentId,
              e
            );
          }
        }
        setTaskCompletions({
          byAssignmentId: completedAssignmentIds,
          byGroupAssignmentId: completedGroupAssignmentIds,
        });

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

  useEffect(
    () => () => {
      if (snackbarTimeoutRef.current) clearTimeout(snackbarTimeoutRef.current);
    },
    []
  );

  const toggleExpanded = (regId: string) => {
    setExpandedRegIds((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  };

  const handleAttendanceChange = async (regId: string, value: string) => {
    const previousValue = attendances[regId] ?? "";
    setAttendances((prev) => ({ ...prev, [regId]: value }));
    setSavingAttendanceId(regId);
    try {
      if (!value) {
        const r = await fetch(
          `/api/session-attendances?course_registration_id=${encodeURIComponent(
            regId
          )}&period_date_id=${encodeURIComponent(sessionId)}`,
          { method: "DELETE" }
        );
        if (!r.ok) {
          const d = await r.json();
          throw new Error(d.error || "Error al guardar asistencia");
        }
        setAttendances((prev) => {
          const next = { ...prev };
          delete next[regId];
          return next;
        });
      } else {
        const r = await fetch("/api/session-attendances", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_registration_id: regId,
            period_date_id: sessionId,
            attendance_status: value,
          }),
        });
        if (!r.ok) {
          const d = await r.json();
          throw new Error(d.error || "Error al guardar asistencia");
        }
      }
      showSnackbar("Asistencia actualizada");
    } catch (e) {
      console.error("Error saving attendance:", e);
      showSnackbar(
        e instanceof Error ? e.message : "No se pudo actualizar la asistencia"
      );
      setAttendances((prev) => ({ ...prev, [regId]: previousValue }));
    } finally {
      setSavingAttendanceId(null);
    }
  };

  const handleSave = async (regId: string) => {
    setSavingId(regId);
    try {
      const commentText = (comments[regId] ?? "").trim();
      const assignmentText = (assignments[regId] ?? "").trim();

      if (!commentText) {
        const comDel = await fetch(
          `/api/session-comments?course_registration_id=${encodeURIComponent(
            regId
          )}&period_date_id=${encodeURIComponent(sessionId)}`,
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

      if (!assignmentText) {
        const assDel = await fetch(
          `/api/session-assignments?course_registration_id=${encodeURIComponent(
            regId
          )}&period_date_id=${encodeURIComponent(sessionId)}`,
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
      showSnackbar(
        e instanceof Error ? e.message : "No se pudieron guardar los datos"
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteComment = async (regId: string) => {
    setDeletingCommentFor(regId);
    try {
      const r = await fetch(
        `/api/session-comments?course_registration_id=${encodeURIComponent(
          regId
        )}&period_date_id=${encodeURIComponent(sessionId)}`,
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
      showSnackbar(
        e instanceof Error ? e.message : "No se pudo eliminar el comentario"
      );
    } finally {
      setDeletingCommentFor(null);
    }
  };

  const handleSaveGroupAssignment = async () => {
    const text = groupAssignmentText.trim();
    setSavingGroupAssignment(true);
    try {
      if (!text) {
        const r = await fetch(
          `/api/session-group-assignments?period_date_id=${encodeURIComponent(
            sessionId
          )}`,
          { method: "DELETE" }
        );
        if (!r.ok) {
          const d = await r.json();
          throw new Error(d.error || "Error al eliminar");
        }
        setGroupAssignmentText("");
        setGroupAssignmentSaved(false);
        setEditingGroupAssignment(false);
        showSnackbar("Tarea grupal eliminada");
        return;
      }
      const r = await fetch("/api/session-group-assignments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_date_id: sessionId,
          assignment_text: text,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al guardar tarea grupal");
      }
      setGroupAssignmentSaved(true);
      setEditingGroupAssignment(false);
      showSnackbar("Tarea grupal guardada");
    } catch (e) {
      console.error("Error saving group assignment:", e);
      showSnackbar(
        e instanceof Error ? e.message : "No se pudo guardar la tarea grupal"
      );
    } finally {
      setSavingGroupAssignment(false);
    }
  };

  const handleDeleteGroupAssignment = async () => {
    setDeletingGroupAssignment(true);
    try {
      const r = await fetch(
        `/api/session-group-assignments?period_date_id=${encodeURIComponent(
          sessionId
        )}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al eliminar");
      }
      setGroupAssignmentText("");
      setGroupAssignmentSaved(false);
      setEditingGroupAssignment(false);
      showSnackbar("Tarea grupal eliminada");
    } catch (e) {
      console.error("Error deleting group assignment:", e);
      showSnackbar(
        e instanceof Error ? e.message : "No se pudo eliminar la tarea grupal"
      );
    } finally {
      setDeletingGroupAssignment(false);
    }
  };

  const handleDeleteAssignment = async (regId: string) => {
    setDeletingAssignmentFor(regId);
    try {
      const r = await fetch(
        `/api/session-assignments?course_registration_id=${encodeURIComponent(
          regId
        )}&period_date_id=${encodeURIComponent(sessionId)}`,
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
      showSnackbar(
        e instanceof Error ? e.message : "No se pudo eliminar la tarea"
      );
    } finally {
      setDeletingAssignmentFor(null);
    }
  };

  const studentName = (r: CourseRegistration) =>
    r.student
      ? [r.student.first_name, r.student.last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || "Sin nombre"
      : "Sin nombre";

  if (loading)
    return <p className="text-gray-500 text-sm">Cargando estudiantes...</p>;
  if (error) return <p className="text-amber-600 text-sm">{error}</p>;
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
      <ul className="space-y-2 mb-6">
        {registrations.map((reg) => {
          const isExpanded = expandedRegIds.has(reg.id);
          return (
            <li
              key={reg.id}
              className="rounded-lg border border-gray-200 bg-white hover:border-gray-300 overflow-hidden"
            >
              {/* Cabecera siempre visible: nombre, asistencia, expediente, expandir */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleExpanded(reg.id)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-md hover:bg-gray-50 -m-1 p-1"
                  aria-expanded={isExpanded}
                >
                  <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  <p className="font-medium text-gray-900 truncate">
                    {studentName(reg)}
                  </p>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                  )}
                </button>
                <select
                  value={attendances[reg.id] ?? ""}
                  onChange={(e) =>
                    handleAttendanceChange(reg.id, e.target.value)
                  }
                  disabled={savingAttendanceId === reg.id}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm px-2 py-1.5 border bg-white min-w-[120px] disabled:opacity-60"
                  title="Asistencia (se guarda al cambiar)"
                >
                  {ATTENDANCE_OPTIONS.map((opt) => (
                    <option key={opt.value || "empty"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Link
                  href={`${base}/estudiante/${reg.id}${
                    sessionId ? `?sesion=${sessionId}` : ""
                  }`}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  <FileText className="h-4 w-4" />
                  Expediente
                </Link>
              </div>

              {/* Contenido expandible: comentario, tarea, guardar, evaluaciones, insignias */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50/50 px-3 py-4 pl-14">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comentario del profesor
                      </p>
                      <div className="mt-0.5">
                        {savedCommentIds.has(reg.id) &&
                        editingCommentFor !== reg.id ? (
                          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {comments[reg.id]}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingCommentFor(reg.id)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(reg.id)}
                                disabled={deletingCommentFor === reg.id}
                                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Eliminar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <textarea
                            placeholder="Escribe un comentario..."
                            value={comments[reg.id] ?? ""}
                            onChange={(e) =>
                              setComments((prev) => ({
                                ...prev,
                                [reg.id]: e.target.value,
                              }))
                            }
                            disabled={savingId === reg.id}
                            rows={2}
                            maxLength={1500}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                        <ClipboardList className="h-3.5 w-3.5" />
                        Tarea individual
                        {assignmentIdByRegId[reg.id] &&
                          taskCompletions.byAssignmentId.has(
                            assignmentIdByRegId[reg.id]
                          ) && (
                            <span
                              className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
                              title="El encargado marcó esta tarea como completada"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Completada
                            </span>
                          )}
                      </p>
                      <div className="mt-0.5">
                        {savedAssignmentIds.has(reg.id) &&
                        editingAssignmentFor !== reg.id ? (
                          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {assignments[reg.id]}
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingAssignmentFor(reg.id)}
                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAssignment(reg.id)}
                                disabled={deletingAssignmentFor === reg.id}
                                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Eliminar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <textarea
                            placeholder="Escribe la tarea para esta sesión..."
                            value={assignments[reg.id] ?? ""}
                            onChange={(e) =>
                              setAssignments((prev) => ({
                                ...prev,
                                [reg.id]: e.target.value,
                              }))
                            }
                            disabled={savingId === reg.id}
                            rows={2}
                            maxLength={1500}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <button
                        onClick={() => handleSave(reg.id)}
                        disabled={savingId === reg.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingId === reg.id ? (
                          "Guardando..."
                        ) : (
                          <>
                            <Save className="h-4 w-4" /> Guardar comentario y
                            tarea
                          </>
                        )}
                      </button>
                    </div>

                    <div>
                      <AulaSongEvaluations
                        registrationId={reg.id}
                        sessionId={sessionId}
                        subjectId={subjectId}
                        academyId={academyId}
                        onSnackbar={showSnackbar}
                      />
                    </div>

                    <div>
                      <AulaBadgeAssignment
                        registrationId={reg.id}
                        academyId={academyId}
                        onSnackbar={showSnackbar}
                      />
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Tarea grupal (para todos los estudiantes de la sesión) */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          Tarea grupal
        </h3>
        <p className="text-xs text-gray-500 mb-2">
          Esta tarea se aplica a todos los estudiantes de la sesión.
        </p>
        {groupAssignmentSaved && !editingGroupAssignment ? (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {groupAssignmentText || "—"}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingGroupAssignment(true)}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
              >
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
              <button
                type="button"
                onClick={handleDeleteGroupAssignment}
                disabled={deletingGroupAssignment}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </button>
            </div>
            {/* Show which students have completed the group task */}
            {groupAssignmentId && registrations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-2">
                  Estado de completado por estudiante:
                </p>
                <div className="flex flex-wrap gap-2">
                  {registrations.map((reg) => {
                    const studentId = reg.student?.id;
                    const isCompleted =
                      studentId &&
                      groupAssignmentId &&
                      taskCompletions.byGroupAssignmentId.has(
                        `${groupAssignmentId}-${studentId}`
                      );
                    return (
                      <span
                        key={reg.id}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          isCompleted
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {isCompleted && <CheckCircle2 className="h-3 w-3" />}
                        {studentName(reg)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <textarea
              placeholder="Escribe la tarea grupal para esta sesión..."
              value={groupAssignmentText}
              onChange={(e) => setGroupAssignmentText(e.target.value)}
              disabled={savingGroupAssignment}
              rows={3}
              maxLength={1500}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSaveGroupAssignment}
                disabled={savingGroupAssignment}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingGroupAssignment ? (
                  "Guardando..."
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Guardar tarea grupal
                  </>
                )}
              </button>
              {groupAssignmentSaved && (
                <button
                  type="button"
                  onClick={() => setEditingGroupAssignment(false)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </>
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
    </>
  );
}
