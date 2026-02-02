"use client";

import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { HogarStudentList } from "./HogarStudentList";
import { HogarStudentView } from "./HogarStudentView";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  enrollment_status?: string | null;
  date_of_birth?: string | null;
  relationship?: string | null;
};

export function HogarContent({
  guardianId,
  guardianName,
}: {
  guardianId?: string;
  guardianName?: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  useEffect(() => {
    async function loadStudents() {
      setLoading(true);
      setError(null);
      try {
        const url = guardianId
          ? `/api/guardian/students?guardian_id=${guardianId}`
          : "/api/guardian/students";
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error al cargar estudiantes");
        }
        setStudents(data.students || []);
        // Auto-select first student
        if (data.students && data.students.length > 0) {
          setSelectedStudentId(data.students[0].id);
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Error al cargar estudiantes"
        );
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, [guardianId]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
          <Home className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {guardianName || "Portal Hogar"}
          </h2>
          <p className="text-sm text-gray-500">Revisa tu progreso académico</p>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-amber-800 text-sm">{error}</p>
        </div>
      )}

      {/* Student selector */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase mb-2">
          Estudiantes a cargo
        </p>
        <HogarStudentList
          students={students}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
          loading={loading}
        />
      </div>

      {/* Selected student view */}
      {selectedStudent && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <HogarStudentView student={selectedStudent} guardianId={guardianId} />
        </div>
      )}

      {/* No students state */}
      {!loading && students.length === 0 && !error && (
        <div className="text-center py-12 rounded-lg border border-dashed border-gray-300 bg-gray-50">
          <Home className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            No hay estudiantes asignados a este encargado.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Contacta al administrador de la academia para asignar estudiantes.
          </p>
        </div>
      )}
    </div>
  );
}
