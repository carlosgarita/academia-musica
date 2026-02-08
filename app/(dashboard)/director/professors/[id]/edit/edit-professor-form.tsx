"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface EditProfessorFormProps {
  professorId: string;
}

export function EditProfessorForm({ professorId }: EditProfessorFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [status, setStatus] = useState("active");

  useEffect(() => {
    loadProfessorData();
  }, [professorId]);

  async function loadProfessorData() {
    try {
      setIsLoadingData(true);
      const response = await fetch(`/api/professors/${professorId}`);
      if (!response.ok) {
        throw new Error("Failed to load professor");
      }
      const data = await response.json();
      const professor = data.professor;

      setFirstName(professor.first_name || "");
      setLastName(professor.last_name || "");
      setEmail(professor.email || "");
      setPhone(professor.phone || "");
      setAdditionalInfo(professor.additional_info || "");
      setStatus(professor.status || "active");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar el profesor"
      );
    } finally {
      setIsLoadingData(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      setError("Nombre, apellido y email son requeridos");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/professors/${professorId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone?.trim() || null,
          additional_info: additionalInfo?.trim() || null,
          status: status || "active",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.details
          ? `${data.error || "Error"}: ${data.details}`
          : data.error || "Error al actualizar el profesor";
        throw new Error(msg);
      }

      router.push("/director/professors");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar el profesor"
      );
      setIsLoading(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando profesor...</div>
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

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            maxLength={255}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Máximo 255 caracteres</p>
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700"
          >
            Teléfono
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            maxLength={20}
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Máximo 20 caracteres</p>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700"
          >
            Estado
          </label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </div>

      {/* Subjects */}
      <div>
        <label
          htmlFor="additionalInfo"
          className="block text-sm font-medium text-gray-700"
        >
          Información Adicional
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
