"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Student = {
  id: string;
  name: string;
  enrollment_status: string;
  date_of_birth: string | null;
};

type Assignment = {
  id: string;
  relationship: string | null;
  created_at: string;
  student: {
    id: string;
    name: string;
    enrollment_status: string;
    date_of_birth: string | null;
  };
};

export default function GuardianStudentsPage() {
  const router = useRouter();
  const params = useParams();
  const guardianId = params.id as string;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardianName, setGuardianName] = useState("");

  useEffect(() => {
    loadData();
  }, [guardianId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load guardian info and current assignments
      const [guardianResponse, studentsResponse] = await Promise.all([
        fetch(`/api/guardians/${guardianId}`),
        fetch("/api/students"),
      ]);

      if (!guardianResponse.ok) {
        throw new Error("Failed to load guardian");
      }

      const guardianData = await guardianResponse.json();
      const guardian = guardianData.guardian;
      setGuardianName(
        `${guardian.first_name || ""} ${guardian.last_name || ""}`.trim() ||
          guardian.email
      );

      // Load assignments
      const assignmentsResponse = await fetch(
        `/api/guardians/${guardianId}/students`
      );
      let assignmentsData = { assignments: [] };
      if (assignmentsResponse.ok) {
        assignmentsData = await assignmentsResponse.json();
        setAssignments(assignmentsData.assignments || []);
      }

      // Load available students
      if (studentsResponse.ok) {
        const studentsData = await studentsResponse.json();
        const allStudents = studentsData.students || [];
        // Filter only active students that are not already assigned
        const assignedStudentIds = (assignmentsData.assignments || []).map(
          (a: Assignment) => a.student.id
        );
        const available = allStudents.filter(
          (s: Student) =>
            s.enrollment_status === "inscrito" &&
            !assignedStudentIds.includes(s.id)
        );
        setAvailableStudents(available);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar los datos"
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  async function handleAssignStudents() {
    if (selectedStudentIds.length === 0) {
      alert("Por favor selecciona al menos un estudiante");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/guardians/${guardianId}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_ids: selectedStudentIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Construir mensaje de error más descriptivo
        let errorMessage = data.error || "Error al asignar estudiantes";
        if (data.details) {
          errorMessage += `\n\n${data.details}`;
        }
        throw new Error(errorMessage);
      }

      // Reload data
      await loadData();
      setSelectedStudentIds([]);
      alert("Estudiantes asignados exitosamente");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al asignar estudiantes";
      setError(errorMessage);
      // Mostrar alert para que el usuario vea el error claramente
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveAssignment(assignmentId: string, studentName: string) {
    if (!confirm(`¿Deseas remover a "${studentName}" de este encargado?`)) {
      return;
    }

    try {
      const response = await fetch(
        `/api/guardians/${guardianId}/students?assignment_id=${assignmentId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove assignment");
      }

      // Reload data
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al remover asignación");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/director/guardians"
          className="text-sm text-indigo-600 hover:text-indigo-500 mb-2 inline-block"
        >
          ← Volver a Encargados
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Estudiantes de {guardianName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Asigna estudiantes a este encargado
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current Assignments */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Estudiantes Asignados ({assignments.length})
          </h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No hay estudiantes asignados
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {`${assignment.student.first_name || ""} ${assignment.student.last_name || ""}`.trim() || "Sin nombre"}
                    </p>
                    {assignment.student.date_of_birth && (
                      <p className="text-xs text-gray-500">
                        {new Date(assignment.student.date_of_birth).toLocaleDateString(
                          "es-ES"
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      handleRemoveAssignment(
                        assignment.id,
                        `${assignment.student.first_name || ""} ${assignment.student.last_name || ""}`.trim() || "Sin nombre"
                      )
                    }
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Available Students */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Estudiantes Disponibles
          </h2>
          {availableStudents.length === 0 ? (
            <p className="text-sm text-gray-400 italic">
              No hay estudiantes disponibles para asignar
            </p>
          ) : (
            <>
              <div className="border border-gray-300 rounded-md p-4 max-h-96 overflow-y-auto mb-4">
                <div className="space-y-2">
                  {availableStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm text-gray-700">
                          {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre"}
                        </span>
                        {student.date_of_birth && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({new Date(student.date_of_birth).toLocaleDateString(
                              "es-ES"
                            )})
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {selectedStudentIds.length > 0 && (
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {selectedStudentIds.length} estudiante(s) seleccionado(s)
                  </p>
                  <button
                    onClick={handleAssignStudents}
                    disabled={submitting}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Asignando..." : "Asignar Estudiantes"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
