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
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {students.map((student) => (
              <li key={student.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {`${student.first_name || ""} ${
                        student.last_name || ""
                      }`.trim() || "Sin nombre"}
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      {student.date_of_birth && (
                        <div>
                          <span className="font-medium">
                            Fecha de nacimiento:
                          </span>{" "}
                          {new Date(student.date_of_birth).toLocaleDateString(
                            "es-ES"
                          )}
                        </div>
                      )}
                      {student.additional_info && (
                        <div>
                          <span className="font-medium">Info adicional:</span>{" "}
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
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
