"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDatabase } from "@/lib/hooks/useDatabase";
import type { Database } from "@/lib/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface StudentsListProps {
  academyId: string;
}

export function StudentsList({ academyId }: StudentsListProps) {
  const db = useDatabase();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrollmentFilter, setEnrollmentFilter] = useState<
    "all" | "inscrito" | "retirado" | "graduado"
  >("inscrito");

  useEffect(() => {
    async function loadStudents() {
      try {
        const { data, error } = await db.getStudents(academyId);

        if (error) {
          throw error;
        }

        setStudents(data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar los estudiantes"
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadStudents();
  }, [academyId, db]);

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
      const { data, error } = await db.getStudents(academyId);
      if (error) {
        throw error;
      }
      setStudents(data || []);
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
  const formatName = (firstName: string | null, lastName: string | null): string => {
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
            Gestiona los estudiantes de tu academia
          </p>
        </div>
        <Link
          href="/director/students/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nuevo Estudiante
        </Link>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay estudiantes registrados aún.</p>
          <Link
            href="/director/students/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear tu primer estudiante
          </Link>
        </div>
      ) : (
        <>
          {/* Enrollment Status Filter - Only show when there are students */}
          <div className="bg-white shadow rounded-lg p-4">
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
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">
                No hay estudiantes{" "}
                {enrollmentFilter === "inscrito"
                  ? "inscritos"
                  : enrollmentFilter === "retirado"
                  ? "retirados"
                  : "graduados"}
                .
              </p>
              <button
                onClick={() => setEnrollmentFilter("all")}
                className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
              >
                Ver todos los estudiantes
              </button>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                  const fullName = formatName(student.first_name, student.last_name);

                  return (
                    <li key={student.id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {fullName}
                          </h3>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
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
                            <div>
                              <span className="font-medium">Estado:</span>{" "}
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  student.enrollment_status === "inscrito"
                                    ? "bg-green-100 text-green-800"
                                    : student.enrollment_status === "retirado"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {student.enrollment_status || "inscrito"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          <Link
                            href={`/director/students/${student.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => handleDelete(student.id, fullName)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium text-left"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
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
