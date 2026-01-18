"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface EditStudentFormProps {
  studentId: string;
  academyId: string;
}

export function EditStudentForm({ studentId, academyId }: EditStudentFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [enrollmentStatus, setEnrollmentStatus] = useState("inscrito");

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  async function loadStudentData() {
    try {
      setIsLoadingData(true);
      const response = await fetch(`/api/students/${studentId}`);
      if (!response.ok) {
        throw new Error("Failed to load student");
      }
      const data = await response.json();
      const student = data.student;

      // Populate form with existing data
      setFirstName(student.first_name || "");
      setLastName(student.last_name || "");
      setDateOfBirth(student.date_of_birth ? student.date_of_birth.split('T')[0] : "");
      setAdditionalInfo(student.additional_info || "");
      setEnrollmentStatus(student.enrollment_status || "inscrito");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar el estudiante"
      );
    } finally {
      setIsLoadingData(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validation
    if (!firstName || !lastName) {
      setError("Nombre y apellido son requeridos");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth || null,
          additional_info: additionalInfo?.trim() || null,
          enrollment_status: enrollmentStatus || "inscrito",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.details
          ? `${data.error || "Error"}: ${data.details}`
          : data.error || "Error al actualizar el estudiante";
        throw new Error(errorMessage);
      }

      router.push("/director/students");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar el estudiante"
      );
      setIsLoading(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando estudiante...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* First Name */}
        <div>
          <label
            htmlFor="firstName"
            className="block text-sm font-medium text-gray-700"
          >
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            required
            maxLength={50}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Máximo 50 caracteres</p>
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="lastName"
            className="block text-sm font-medium text-gray-700"
          >
            Apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            required
            maxLength={50}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Máximo 50 caracteres</p>
        </div>
      </div>

      {/* Date of Birth */}
      <div>
        <label
          htmlFor="dateOfBirth"
          className="block text-sm font-medium text-gray-700"
        >
          Fecha de Nacimiento
        </label>
        <input
          type="date"
          id="dateOfBirth"
          name="dateOfBirth"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {/* Enrollment Status */}
      <div>
        <label
          htmlFor="enrollmentStatus"
          className="block text-sm font-medium text-gray-700"
        >
          Estado de Inscripción
        </label>
        <select
          id="enrollmentStatus"
          name="enrollmentStatus"
          value={enrollmentStatus}
          onChange={(e) => setEnrollmentStatus(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="inscrito">Inscrito</option>
          <option value="retirado">Retirado</option>
          <option value="graduado">Graduado</option>
        </select>
      </div>

      {/* Additional Info */}
      <div>
        <label
          htmlFor="additionalInfo"
          className="block text-sm font-medium text-gray-700"
        >
          Información Adicional del Estudiante
        </label>
        <textarea
          id="additionalInfo"
          name="additionalInfo"
          rows={3}
          maxLength={500}
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">Máximo 500 caracteres</p>
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
          disabled={isLoading}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
