"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";

type Period = { id: string; year: number; period: string };
type Course = {
  id: string;
  profile_id: string;
  subject_id: string;
  period_id: string;
  subject?: { id: string; name: string };
  profile?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email?: string;
  };
  period?: Period;
  sessions_count?: number;
  turnos_count?: number;
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  enrollment_status?: string;
};

type Reg = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  profile_id: string | null;
  student: { id: string; first_name: string; last_name: string } | null;
};

function professorName(
  p:
    | { first_name?: string | null; last_name?: string | null; email?: string }
    | undefined
) {
  if (!p) return "—";
  const n = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return n || p.email || "—";
}

export default function CourseRegistrationsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAdd, setExpandedAdd] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [cRes, rRes, sRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/course-registrations"),
        fetch("/api/students"),
      ]);
      const cData = await cRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      if (!cRes.ok) throw new Error(cData.error || "Error al cargar cursos");
      if (!rRes.ok)
        throw new Error(rData.error || "Error al cargar matrículas");
      setCourses(cData.courses || []);
      setRegs(rData.courseRegistrations || []);
      setStudents(
        (sData.students || []).filter(
          (s: Student) => s.enrollment_status !== "retirado"
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  // Agrupar matrículas por curso: (subject_id, period_id, profile_id)
  function regsForCourse(c: Course): Reg[] {
    return regs.filter(
      (r) =>
        r.subject_id === c.subject_id &&
        r.period_id === c.period_id &&
        r.profile_id === c.profile_id
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-600">Cargando matrículas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Agrega estudiantes a cada curso y genera contratos de forma masiva
          </p>
        </div>
        <Link
          href="/director/direccion/course-registrations/special-registrations"
          className="inline-flex items-center gap-2 rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500"
        >
          Matrículas Especiales
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay cursos creados.</p>
          <p className="mt-1 text-sm text-gray-500">
            Crea cursos en la sección Cursos para poder matricular estudiantes.
          </p>
          <Link
            href="/director/direccion/courses"
            className="mt-4 inline-flex text-indigo-600 hover:text-indigo-500"
          >
            Ir a Cursos
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {courses.map((c) => (
            <CourseBlock
              key={c.id}
              course={c}
              regs={regsForCourse(c)}
              students={students}
              expandedAdd={expandedAdd === c.id}
              onToggleAdd={() =>
                setExpandedAdd((x) => (x === c.id ? null : c.id))
              }
              onGenerateContracts={async (studentIds) => {
                setSending(c.id);
                try {
                  const r = await fetch("/api/course-registrations/bulk-with-contracts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      course_id: c.id,
                      student_ids: studentIds,
                    }),
                  });
                  const d = await r.json();
                  if (!r.ok)
                    throw new Error(
                      d.error || d.details || "Error al generar contratos"
                    );
                  setExpandedAdd(null);
                  load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Error al generar contratos");
                } finally {
                  setSending(null);
                }
              }}
              onRemove={async (regId) => {
                try {
                  const r = await fetch(`/api/course-registrations/${regId}`, {
                    method: "DELETE",
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error || "Error al eliminar");
                  load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Error");
                }
              }}
              sending={sending === c.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CourseBlockProps = {
  course: Course;
  regs: Reg[];
  students: Student[];
  expandedAdd: boolean;
  onToggleAdd: () => void;
  onGenerateContracts: (studentIds: string[]) => Promise<void>;
  onRemove: (regId: string) => Promise<void>;
  sending: boolean;
};

function CourseBlock({
  course,
  regs,
  students,
  expandedAdd,
  onToggleAdd,
  onGenerateContracts,
  onRemove,
  sending,
}: CourseBlockProps) {
  const [studentId, setStudentId] = useState("");
  const [pendingStudents, setPendingStudents] = useState<Student[]>([]);

  const enrolledIds = new Set(regs.map((r) => r.student_id));
  const pendingIds = new Set(pendingStudents.map((s) => s.id));
  const availableStudents = students.filter(
    (s) => !enrolledIds.has(s.id) && !pendingIds.has(s.id)
  );

  function addToPending() {
    if (!studentId) return;
    const student = students.find((s) => s.id === studentId);
    if (student) {
      setPendingStudents((prev) => [...prev, student]);
      setStudentId("");
    }
  }

  function removeFromPending(id: string) {
    setPendingStudents((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleGenerateContracts() {
    if (pendingStudents.length === 0) return;
    await onGenerateContracts(pendingStudents.map((s) => s.id));
    setPendingStudents([]);
  }

  const cl = course.subject?.name ?? "—";
  const prof = professorName(course.profile);
  const pd = course.period
    ? `${course.period.year} – ${course.period.period}`
    : "—";

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-lg font-medium text-gray-900">{cl}</h2>
          <span className="text-gray-400">·</span>
          <span className="text-gray-600">{prof}</span>
          <span className="text-sm text-gray-500">{pd}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {course.sessions_count ?? 0} sesiones
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {course.turnos_count ?? 0} turnos
          </span>
        </div>

        {/* Lista de matriculados */}
        <div className="mt-4">
          {regs.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {regs.map((r) => {
                const sn = r.student
                  ? `${r.student.first_name} ${r.student.last_name}`.trim() ||
                    "—"
                  : "—";
                return (
                  <li
                    key={r.id}
                    className="py-2 flex justify-between items-center"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {sn}
                    </span>
                    <div className="flex gap-4">
                      <Link
                        href={`/director/direccion/course-registrations/${r.id}/edit`}
                        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar Estado
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Quitar a ${sn} de este curso?`))
                            onRemove(r.id);
                        }}
                        className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              Ningún estudiante matriculado en este curso.
            </p>
          )}

          {/* Botón Agregar Estudiante */}
          <div className="mt-3">
            <button
              type="button"
              onClick={onToggleAdd}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-900"
            >
              {expandedAdd ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <UserPlus className="h-4 w-4" />
              Agregar Estudiante
            </button>

            {/* Formulario expandido: dropdown estudiantes + canciones */}
            {expandedAdd && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Estudiante
                    </label>
                    <select
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="">Seleccione un estudiante</option>
                      {availableStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                        </option>
                      ))}
                      {availableStudents.length === 0 && (
                        <option value="" disabled>
                          No hay estudiantes activos disponibles
                        </option>
                      )}
                    </select>
                    {availableStudents.length === 0 && pendingStudents.length === 0 && (
                      <p className="mt-1 text-sm text-amber-600">
                        Todos los estudiantes activos ya están matriculados en
                        este curso o no hay estudiantes.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={addToPending}
                    disabled={!studentId}
                      className="rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 disabled:opacity-50"
                    >
                      Agregar Estudiante
                    </button>

                  {pendingStudents.length > 0 && (
                    <>
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Estudiantes agregados ({pendingStudents.length})
                        </h4>
                        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white max-h-40 overflow-y-auto">
                          {pendingStudents.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between px-3 py-2"
                            >
                              <span className="text-sm font-medium text-gray-900">
                                {s.first_name} {s.last_name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFromPending(s.id)}
                                className="text-gray-500 hover:text-red-600 text-sm"
                              >
                                Quitar
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleGenerateContracts}
                          disabled={sending}
                          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sending ? "Generando…" : "Matricular y Generar Contrato(s)"}
                        </button>
                        <button
                          type="button"
                          onClick={onToggleAdd}
                          className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          Cerrar
                        </button>
                      </div>
                    </>
                  )}

                  {pendingStudents.length === 0 && (
                    <button
                      type="button"
                      onClick={onToggleAdd}
                      className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
