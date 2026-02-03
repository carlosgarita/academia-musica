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
type Song = {
  id: string;
  name: string;
  author: string | null;
  difficulty_level: number;
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
  const [songs, setSongs] = useState<Song[]>([]);
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
      const [cRes, rRes, sRes, soRes] = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/course-registrations"),
        fetch("/api/students"),
        fetch("/api/songs"),
      ]);
      const cData = await cRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      const soData = await soRes.json();
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
      setSongs(soData.songs || []);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Agrega estudiantes a cada curso y asígnales canciones para el periodo
        </p>
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
              songs={songs}
              expandedAdd={expandedAdd === c.id}
              onToggleAdd={() =>
                setExpandedAdd((x) => (x === c.id ? null : c.id))
              }
              onEnroll={async (studentId, songIds) => {
                setSending(c.id);
                try {
                  const r = await fetch("/api/course-registrations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      student_id: studentId,
                      subject_id: c.subject_id,
                      period_id: c.period_id,
                      profile_id: c.profile_id,
                      song_ids: songIds,
                    }),
                  });
                  const d = await r.json();
                  if (!r.ok)
                    throw new Error(
                      d.error || d.details || "Error al matricular"
                    );
                  setExpandedAdd(null);
                  load();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Error al matricular");
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
  songs: Song[];
  expandedAdd: boolean;
  onToggleAdd: () => void;
  onEnroll: (studentId: string, songIds: string[]) => Promise<void>;
  onRemove: (regId: string) => Promise<void>;
  sending: boolean;
};

function CourseBlock({
  course,
  regs,
  students,
  songs,
  expandedAdd,
  onToggleAdd,
  onEnroll,
  onRemove,
  sending,
}: CourseBlockProps) {
  const [studentId, setStudentId] = useState("");
  const [songIds, setSongIds] = useState<string[]>([]);

  const enrolledIds = new Set(regs.map((r) => r.student_id));
  const availableStudents = students.filter((s) => !enrolledIds.has(s.id));

  function toggleSong(id: string) {
    setSongIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    await onEnroll(studentId, songIds);
    setStudentId("");
    setSongIds([]);
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
                        Editar
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
              <form
                onSubmit={handleSubmit}
                className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Estudiante
                    </label>
                    <select
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      required={availableStudents.length > 0}
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
                    {availableStudents.length === 0 && (
                      <p className="mt-1 text-sm text-amber-600">
                        Todos los estudiantes activos ya están matriculados en
                        este curso o no hay estudiantes.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Canciones para este curso y periodo
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md bg-white p-3 space-y-2">
                      {songs.length === 0 ? (
                        <p className="text-sm text-gray-500">
                          No hay canciones en la academia.
                        </p>
                      ) : (
                        songs.map((s) => (
                          <label key={s.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={songIds.includes(s.id)}
                              onChange={() => toggleSong(s.id)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm">
                              {s.name}
                              {s.author ? ` — ${s.author}` : ""}{" "}
                              <span className="text-gray-400">
                                (nivel {s.difficulty_level})
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={sending || !studentId}
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {sending ? "Matriculando…" : "Matricular"}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleAdd}
                      className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
