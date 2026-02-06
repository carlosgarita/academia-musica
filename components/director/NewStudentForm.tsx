"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDatabase } from "@/lib/hooks/useDatabase";

interface NewStudentFormProps {
  academyId: string;
}

export function NewStudentForm({ academyId }: NewStudentFormProps) {
  const router = useRouter();
  const db = useDatabase();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOwnGuardian, setIsOwnGuardian] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const dateOfBirth = formData.get("dateOfBirth") as string;
    const enrollmentStatusRaw = formData.get("enrollmentStatus") as string | null;
    const additionalInfo = formData.get("additionalInfo") as string;

    // Guardian form data (when isOwnGuardian is checked)
    const guardianEmail = formData.get("guardianEmail") as string;
    const guardianPhone = formData.get("guardianPhone") as string;
    const guardianPassword = formData.get("guardianPassword") as string;
    const guardianAdditionalInfo = formData.get(
      "guardianAdditionalInfo"
    ) as string;

    // Validation
    if (!firstName || !lastName) {
      setError("Nombre y apellido son requeridos");
      setIsLoading(false);
      return;
    }

    if (isOwnGuardian) {
      if (!guardianEmail?.trim()) {
        setError("El email del encargado es requerido");
        setIsLoading(false);
        return;
      }
      if (!guardianPassword || guardianPassword.length < 6) {
        setError("La contraseña del encargado debe tener al menos 6 caracteres");
        setIsLoading(false);
        return;
      }
    }

    // Validate and set enrollment_status
    const validStatuses = ["inscrito", "retirado", "graduado"] as const;
    type EnrollmentStatus = (typeof validStatuses)[number];
    const enrollmentStatus: EnrollmentStatus =
      enrollmentStatusRaw &&
      validStatuses.includes(enrollmentStatusRaw as EnrollmentStatus)
        ? (enrollmentStatusRaw as EnrollmentStatus)
        : "inscrito";

    try {
      // 1. Create student record
      const { data: newStudent, error: studentError } =
        await db.createStudent({
          academy_id: academyId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth || null,
          enrollment_status: enrollmentStatus,
          additional_info: additionalInfo?.trim() || null,
          is_self_guardian: isOwnGuardian,
        });

      if (studentError || !newStudent) {
        throw studentError ?? new Error("Error al crear el estudiante");
      }

      // 2 & 3. If isOwnGuardian: create guardian and assign student to them
      if (isOwnGuardian && guardianEmail && guardianPassword) {
        const guardianResponse = await fetch("/api/guardians", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: guardianEmail.trim(),
            phone: guardianPhone?.trim() || null,
            password: guardianPassword,
            additional_info: guardianAdditionalInfo?.trim() || null,
            status: "active",
            student_ids: [newStudent.id],
          }),
        });

        const guardianData = await guardianResponse.json();

        if (!guardianResponse.ok) {
          const errorMsg = guardianData.details
            ? `${guardianData.error || "Error"}: ${guardianData.details}`
            : guardianData.error || "Error al crear el encargado";
          throw new Error(errorMsg);
        }
      }

      router.push("/director/students");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el estudiante"
      );
    } finally {
      setIsLoading(false);
    }
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
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
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">Máximo 500 caracteres</p>
      </div>

      {/* Is Own Guardian Checkbox */}
      <div className="border-t border-gray-200 pt-6">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="isOwnGuardian"
            name="isOwnGuardian"
            value="true"
            checked={isOwnGuardian}
            onChange={(e) => setIsOwnGuardian(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label
            htmlFor="isOwnGuardian"
            className="ml-2 block text-sm text-gray-900"
          >
            Este estudiante es mayor de edad y será su propio encargado
          </label>
        </div>
        <p className="mt-1 ml-6 text-xs text-gray-500">
          Si marca esta opción, se creará también un registro de encargado con
          acceso al portal
        </p>
      </div>

      {/* Guardian Fields (shown when isOwnGuardian is checked) */}
      {isOwnGuardian && (
        <div className="space-y-6 border-t border-gray-200 pt-6 bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Información del Encargado
          </h3>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Guardian Email */}
            <div>
              <label
                htmlFor="guardianEmail"
                className="block text-sm font-medium text-gray-700"
              >
                Email del Encargado <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="guardianEmail"
                name="guardianEmail"
                required={isOwnGuardian}
                maxLength={255}
                autoComplete="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Máximo 255 caracteres
              </p>
            </div>

            {/* Guardian Phone */}
            <div>
              <label
                htmlFor="guardianPhone"
                className="block text-sm font-medium text-gray-700"
              >
                Teléfono del Encargado
              </label>
              <input
                type="tel"
                id="guardianPhone"
                name="guardianPhone"
                maxLength={20}
                autoComplete="tel"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Máximo 20 caracteres</p>
            </div>
          </div>

          {/* Guardian Password */}
          <div>
            <label
              htmlFor="guardianPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Contraseña del Encargado <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="guardianPassword"
              name="guardianPassword"
              required={isOwnGuardian}
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Mínimo 6 caracteres, máximo 128
            </p>
          </div>

          {/* Guardian Additional Info */}
          <div>
            <label
              htmlFor="guardianAdditionalInfo"
              className="block text-sm font-medium text-gray-700"
            >
              Información Adicional del Encargado
            </label>
            <textarea
              id="guardianAdditionalInfo"
              name="guardianAdditionalInfo"
              rows={3}
              maxLength={500}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Máximo 500 caracteres</p>
          </div>
        </div>
      )}

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
          {isLoading ? "Creando..." : "Crear Estudiante"}
        </button>
      </div>
    </form>
  );
}
