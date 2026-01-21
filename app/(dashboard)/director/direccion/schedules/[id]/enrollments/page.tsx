"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  enrollment_status: string;
};

type Enrollment = {
  id: string;
  student_id: string;
  student: Student;
};

type Schedule = {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  professor: {
    name: string;
  };
};

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export default function ScheduleEnrollmentsPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Array<{ student_id: string; conflict: string }>>([]);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  useEffect(() => {
    if (scheduleId) {
      loadSchedule();
      loadStudents();
      loadEnrollments();
    }
  }, [scheduleId]);

  async function loadSchedule() {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load schedule");
      }

      setSchedule(data.schedule);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading schedule");
    }
  }

  async function loadStudents() {
    try {
      const response = await fetch("/api/students");
      if (!response.ok) {
        throw new Error("Failed to load students");
      }
      const data = await response.json();
      // Filter only active students
      const activeStudents = (data.students || []).filter(
        (s: Student) => s.enrollment_status === "inscrito"
      );
      setStudents(activeStudents);
    } catch (err) {
      console.error("Error loading students:", err);
    }
  }

  async function loadEnrollments() {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/enrollments`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load enrollments");
      }

      setEnrollments(data.enrollments || []);
    } catch (err) {
      console.error("Error loading enrollments:", err);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflicts([]);
    setSubmitting(true);

    if (selectedStudentIds.length === 0) {
      setError("Debes seleccionar al menos un estudiante");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${scheduleId}/enrollments`, {
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
        if (response.status === 207 && data.conflicts) {
          // Multi-status with conflicts
          setConflicts(data.conflicts);
          if (data.enrollments && data.enrollments.length > 0) {
            alert(
              "Algunos estudiantes se inscribieron exitosamente, pero algunos tuvieron conflictos de horario. Revisa los detalles."
            );
            // Reload enrollments
            loadEnrollments();
            setSelectedStudentIds([]);
          } else {
            setError(data.message || "Error al inscribir estudiantes");
          }
        } else {
          setError(data.error || data.details || "Error al inscribir estudiantes");
        }
        setSubmitting(false);
        return;
      }

      // Success
      loadEnrollments();
      setSelectedStudentIds([]);
      alert("Estudiantes inscritos exitosamente");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al inscribir estudiantes"
      );
      setSubmitting(false);
    }
  }

  async function handleUnenroll(enrollmentId: string) {
    if (!confirm("¿Estás seguro de que deseas remover a este estudiante de la clase?")) {
      return;
    }

    try {
      const response = await fetch(`/api/enrollments/${enrollmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove enrollment");
      }

      loadEnrollments();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error removing enrollment");
    }
  }

  // Get enrolled student IDs
  const enrolledStudentIds = enrollments.map((e) => e.student_id);
  // Filter out already enrolled students from selection
  const availableStudents = students.filter(
    (s) => !enrolledStudentIds.includes(s.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Horario no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Asignar Estudiantes: {schedule.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {DAY_NAMES[schedule.day_of_week - 1]} - {schedule.start_time.substring(0, 5)} a{" "}
          {schedule.end_time.substring(0, 5)}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-sm font-medium text-yellow-800 mb-2">
            Conflictos de horario detectados:
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-700">
            {conflicts.map((conflict, idx) => {
              const student = students.find((s) => s.id === conflict.student_id);
              return (
                <li key={idx}>
                  {student ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre" : "Estudiante"}: {conflict.conflict}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Enrollments */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Estudiantes Inscritos ({enrollments.length})
          </h2>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-500">No hay estudiantes inscritos aún</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {enrollments.map((enrollment) => (
                <li key={enrollment.id} className="py-3 flex justify-between items-center">
                  <span className="text-sm text-gray-900">
                    {`${enrollment.student.first_name || ""} ${enrollment.student.last_name || ""}`.trim() || "Sin nombre"}
                  </span>
                  <button
                    onClick={() => handleUnenroll(enrollment.id)}
                    className="text-sm text-red-600 hover:text-red-900"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Assign Students */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Asignar Estudiantes
          </h2>
          <form onSubmit={handleSubmit}>
            {availableStudents.length === 0 ? (
              <p className="text-sm text-gray-500">
                Todos los estudiantes activos ya están inscritos
              </p>
            ) : (
              <>
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4 mb-4">
                  {availableStudents.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center space-x-2 py-2 cursor-pointer hover:bg-gray-50 px-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-900">
                        {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre"}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || selectedStudentIds.length === 0}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Inscribiendo..." : "Inscribir Estudiantes"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
