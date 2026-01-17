"use client";

import { useEffect, useState } from "react";
import { useDatabase } from "@/lib/hooks/useDatabase";
import type { Database } from "@/lib/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface StudentsListProps {
  professorId: string;
}

export function StudentsList({ professorId }: StudentsListProps) {
  const db = useDatabase();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStudents() {
      try {
        // TODO: Add getAssignedStudents function to get students assigned to this professor
        // For now, we'll show an empty list
        setStudents([]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar los estudiantes"
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadStudents();
  }, [professorId, db]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Cargando estudiantes...</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-500 p-4 rounded-md">{error}</div>;
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No tienes estudiantes asignados</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Mis Estudiantes</h2>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul role="list" className="divide-y divide-gray-200">
          {students.map((student) => (
            <li key={student.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-indigo-600 truncate">
                    {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre"}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
