"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";
import type { Database } from "@/lib/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"] & {
  guardian?: { first_name: string | null; last_name: string | null; email: string } | null;
};
type CourseRegistration =
  Database["public"]["Tables"]["course_registrations"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type Period = Database["public"]["Tables"]["periods"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface CourseRegistrationWithDetails extends CourseRegistration {
  subject: Subject | null;
  period: Period | null;
  professor: Profile | null;
}

type ProfessorCourse = {
  id: string;
  subject?: { name?: string } | null;
  period?: { year?: number; period?: string } | null;
};

interface StudentsListProps {
  academyId: string;
  /** Si true, oculta botones Nuevo/Editar/Eliminar (ej. vista de profesores) */
  readOnly?: boolean;
  /** ID del profesor: filtra estudiantes a los matriculados en sus cursos */
  professorId?: string;
}

export function StudentsList({ academyId, readOnly = false, professorId }: StudentsListProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [coursesByStudent, setCoursesByStudent] = useState<
    Record<string, CourseRegistrationWithDetails[]>
  >({});
  const [professorCourses, setProfessorCourses] = useState<ProfessorCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentFilter, setEnrollmentFilter] = useState<
    "all" | "inscrito" | "retirado" | "graduado"
  >("inscrito");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Cargar cursos del profesor (cuando es vista de profesor)
  useEffect(() => {
    if (!professorId) {
      setProfessorCourses([]);
      setSelectedCourseId("");
      return;
    }
    let cancelled = false;
    async function loadCourses() {
      try {
        const res = await fetch(`/api/courses?profile_id=${professorId}`);
        const data = await res.json();
        if (cancelled) return;
        const list = (data.courses || []).filter((c: ProfessorCourse) => {
          const per = Array.isArray(c.period) ? c.period[0] : c.period;
          const year = (per as { year?: number } | null)?.year;
          const currentYear = new Date().getFullYear();
          return year != null && year >= currentYear - 1;
        });
        setProfessorCourses(list);
      } catch {
        if (!cancelled) setProfessorCourses([]);
      }
    }
    loadCourses();
    return () => { cancelled = true; };
  }, [professorId]);

  // Cargar estudiantes (con encargado desde guardian_students)
  useEffect(() => {
    if (!academyId && !professorId) return;
    if (professorId && !academyId) return; // profesor siempre necesita academyId para course_registrations

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadStudents() {
      try {
        let url = "/api/students";
        if (professorId) {
          const params = new URLSearchParams({ professor_id: professorId });
          if (selectedCourseId) params.set("course_id", selectedCourseId);
          url += `?${params.toString()}`;
        }
        const response = await fetch(url);
        const data = await response.json();

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(data.error || "Error al cargar estudiantes");
        }

        setStudents(data.students || []);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Error al cargar los estudiantes"
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [academyId, professorId, selectedCourseId]);

  // Cargar cursos (separado para evitar loops)
  useEffect(() => {
    if (!academyId) return;

    let cancelled = false;

    async function loadCourses() {
      try {
        // Cargar todos los course_registrations activos de la academia
        const response = await fetch("/api/course-registrations", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (cancelled) return;

        if (!response.ok) {
          // Si falla, simplemente no mostrar cursos, pero no romper la UI
          console.warn(
            "Failed to load courses:",
            response.status,
            response.statusText
          );
          return;
        }

        const data = await response.json();
        const registrations = data.courseRegistrations || [];

        if (cancelled) return;

        // Obtener información de profesores para cada registro
        const profileIds = [
          ...new Set(
            registrations.map((r: { profile_id?: string }) => r.profile_id).filter(Boolean)
          ),
        ];

        let professorsMap: Record<string, Profile> = {};
        if (profileIds.length > 0) {
          try {
            // Cargar profesores (la API filtra automáticamente por academia del usuario)
            const profResponse = await fetch("/api/professors", {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (cancelled) return;

            if (profResponse.ok) {
              const profData = await profResponse.json();
              if (profData.professors) {
                // Filtrar solo los profesores que están en nuestros profile_ids
                const relevantProfessors = profData.professors.filter(
                  (p: Profile) => profileIds.includes(p.id)
                );
                professorsMap = relevantProfessors.reduce(
                  (acc: Record<string, Profile>, p: Profile) => {
                    acc[p.id] = p;
                    return acc;
                  },
                  {}
                );
              }
            }
          } catch (profErr) {
            // Si falla cargar profesores, continuar sin ellos
            console.warn("Failed to load professors:", profErr);
          }
        }

        if (cancelled) return;

        // Combinar datos y agrupar por student_id
        const grouped: Record<string, CourseRegistrationWithDetails[]> = {};
        for (const reg of registrations) {
          const courseWithDetails: CourseRegistrationWithDetails = {
            ...reg,
            subject: reg.subject as Subject | null,
            period: reg.period as Period | null,
            professor: reg.profile_id
              ? professorsMap[reg.profile_id] || null
              : null,
          };

          if (!grouped[reg.student_id]) {
            grouped[reg.student_id] = [];
          }
          grouped[reg.student_id].push(courseWithDetails);
        }

        setCoursesByStudent(grouped);
      } catch (err) {
        if (cancelled) return;
        // No fallar completamente si no se pueden cargar los cursos
        console.error("Error loading courses:", err);
        // Dejar coursesByStudent vacío en caso de error
        setCoursesByStudent({});
      }
    }

    // Pequeño delay para asegurar que el servidor esté listo
    const timeoutId = setTimeout(() => {
      loadCourses();
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [academyId]); // Solo depende de academyId

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar al estudiante "${name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/students/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete student");
      }

      // Reload students
      const res = await fetch("/api/students");
      const data = await res.json();
      if (res.ok) setStudents(data.students || []);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting student");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando estudiantes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // Helper function to format name as "Apellido Nombre"
  const formatName = (
    firstName: string | null,
    lastName: string | null
  ): string => {
    const first = firstName || "";
    const last = lastName || "";
    if (last && first) {
      return `${last} ${first}`.trim();
    }
    if (last) return last;
    if (first) return first;
    return "Sin nombre";
  };

  // Filter and sort students by last name
  const filteredStudents = students
    .filter((student) => {
      if (professorId) return true;
      if (enrollmentFilter === "all") return true;
      return student.enrollment_status === enrollmentFilter;
    })
    .sort((a, b) => {
      const aLast = (a.last_name || "").toLowerCase();
      const bLast = (b.last_name || "").toLowerCase();
      if (aLast < bLast) return -1;
      if (aLast > bLast) return 1;
      // If last names are equal, sort by first name
      const aFirst = (a.first_name || "").toLowerCase();
      const bFirst = (b.first_name || "").toLowerCase();
      if (aFirst < bFirst) return -1;
      if (aFirst > bFirst) return 1;
      return 0;
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estudiantes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {professorId
              ? "Estudiantes matriculados en tus cursos"
              : readOnly
              ? "Lista de estudiantes de la academia"
              : "Gestiona los estudiantes de tu academia"}
          </p>
        </div>
        {!readOnly && (
          <Link
            href="/director/students/new"
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Nuevo Estudiante
          </Link>
        )}
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">
            {professorId
              ? selectedCourseId
                ? "No hay estudiantes matriculados en este curso."
                : "No hay estudiantes matriculados en tus cursos."
              : "No hay estudiantes registrados aún."}
          </p>
          {!readOnly && (
            <Link
              href="/director/students/new"
              className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
            >
              Crear tu primer estudiante
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="bg-white shadow rounded-lg p-4">
            {professorId ? (
              professorCourses.length > 0 ? (
                <div className="flex items-center space-x-4">
                  <label
                    htmlFor="courseFilter"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Filtrar por curso:
                  </label>
                  <select
                    id="courseFilter"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Todos mis cursos activos</option>
                    {professorCourses.map((c) => {
                      const subj = Array.isArray(c.subject) ? c.subject[0] : c.subject;
                      const per = Array.isArray(c.period) ? c.period[0] : c.period;
                      const name = subj?.name || "Curso";
                      const periodStr = per ? `${per.year} – ${per.period}` : "";
                      return (
                        <option key={c.id} value={c.id}>
                          {name} {periodStr}
                        </option>
                      );
                    })}
                  </select>
                  {filteredStudents.length > 0 && (
                    <span className="text-sm text-gray-500">
                      ({filteredStudents.length} estudiante
                      {filteredStudents.length !== 1 ? "s" : ""})
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No tienes cursos activos asignados.
                </p>
              )
            ) : (
              <div className="flex items-center space-x-4">
                <label
                  htmlFor="enrollmentFilter"
                  className="block text-sm font-medium text-gray-700"
                >
                  Filtrar por estado:
                </label>
                <select
                  id="enrollmentFilter"
                  value={enrollmentFilter}
                  onChange={(e) =>
                    setEnrollmentFilter(
                      e.target.value as
                        | "all"
                        | "inscrito"
                        | "retirado"
                        | "graduado"
                    )
                  }
                  className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="inscrito">Inscritos</option>
                  <option value="retirado">Retirados</option>
                  <option value="graduado">Graduados</option>
                </select>
                {enrollmentFilter !== "all" && (
                  <span className="text-sm text-gray-500">
                    ({filteredStudents.length} estudiante
                    {filteredStudents.length !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
            )}
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">
                {professorId
                  ? selectedCourseId
                    ? "No hay estudiantes matriculados en este curso."
                    : "No hay estudiantes matriculados en tus cursos activos."
                  : `No hay estudiantes${
                      enrollmentFilter === "inscrito"
                        ? " inscritos"
                        : enrollmentFilter === "retirado"
                        ? " retirados"
                        : enrollmentFilter === "graduado"
                        ? " graduados"
                        : ""
                    }.`}
              </p>
              {!professorId && enrollmentFilter !== "all" && (
                <button
                  onClick={() => setEnrollmentFilter("all")}
                  className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
                >
                  Ver todos los estudiantes
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                  const fullName = formatName(
                    student.first_name,
                    student.last_name
                  );
                  const isExpanded = expandedIds.has(student.id);

                  return (
                    <li
                      key={student.id}
                      className="border-b border-gray-200 last:border-b-0"
                    >
                      <div className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(student.id)}
                          className="flex items-center gap-2 flex-1 text-left min-w-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                          )}
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {fullName}
                          </h3>
                        </button>
                        {!readOnly && (
                          <div className="ml-4 flex items-center gap-4 shrink-0">
                            <Link
                              href={`/director/students/${student.id}/edit`}
                              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(student.id, fullName);
                              }}
                              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                            >
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 pl-12 bg-gray-50/50">
                          <div className="space-y-1 text-sm text-gray-600">
                            {student.guardian && (
                              <div>
                                <span className="font-medium">
                                  Encargado:
                                </span>{" "}
                                {`${student.guardian.first_name || ""} ${student.guardian.last_name || ""}`.trim() ||
                                  student.guardian.email ||
                                  "—"}
                              </div>
                            )}
                            {student.date_of_birth && (
                              <div>
                                <span className="font-medium">
                                  Fecha de nacimiento:
                                </span>{" "}
                                {new Date(
                                  student.date_of_birth
                                ).toLocaleDateString("es-ES")}
                              </div>
                            )}
                            {student.additional_info && (
                              <div>
                                <span className="font-medium">
                                  Info adicional:
                                </span>{" "}
                                {student.additional_info}
                              </div>
                            )}
                            {/* Cursos matriculados */}
                            {coursesByStudent[student.id] &&
                            coursesByStudent[student.id].length > 0 ? (
                              <div className="mt-3">
                                <span className="font-medium text-gray-700">
                                  Cursos matriculados:
                                </span>
                                <ul className="mt-1 space-y-1">
                                  {coursesByStudent[student.id]
                                    .filter(
                                      (course) => course.status === "active"
                                    )
                                    .map((course) => (
                                      <li
                                        key={course.id}
                                        className="text-xs text-gray-600 pl-2 border-l-2 border-gray-300"
                                      >
                                        <span className="font-medium">
                                          {course.subject?.name ||
                                            "Curso sin nombre"}
                                        </span>
                                        {course.period && (
                                          <span className="text-gray-500">
                                            {" "}
                                            • {course.period.year} –{" "}
                                            {course.period.period}
                                          </span>
                                        )}
                                        {course.professor && (
                                          <span className="text-gray-500">
                                            {" "}
                                            • Prof:{" "}
                                            {`${
                                              course.professor.first_name || ""
                                            } ${
                                              course.professor.last_name || ""
                                            }`.trim() ||
                                              course.professor.email ||
                                              "N/A"}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                </ul>
                              </div>
                            ) : (
                              <div className="mt-3 text-xs text-gray-400">
                                Sin cursos matriculados
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
