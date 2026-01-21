"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Professor = {
  id: string; // Now this is profile.id directly
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  academy_id: string;
  additional_info: string | null;
  created_at: string;
  updated_at: string;
  subjects: Array<{
    subject: {
      id: string;
      name: string;
    };
  }>;
  schedules: Array<{
    id: string;
    name: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }>;
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

interface ProfessorsListProps {
  academyId: string;
}

export function ProfessorsList({ academyId }: ProfessorsListProps) {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");

  useEffect(() => {
    loadProfessors();
  }, []);

  async function loadProfessors() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/professors");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load professors");
      }

      setProfessors(data.professors || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar los profesores"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar al profesor "${name}"? Esta acción eliminará también su cuenta de usuario.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/professors/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete professor");
      }

      // Reload professors
      loadProfessors();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting professor");
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";

    try {
      const response = await fetch(`/api/professors/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      // Reload professors
      loadProfessors();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating status");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando profesores...</div>
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

  // Filter professors based on status filter
  const filteredProfessors = professors.filter((professor) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return professor.status === "active";
    if (statusFilter === "inactive") return professor.status === "inactive";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profesores</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los profesores de tu academia
          </p>
        </div>
        <Link
          href="/director/professors/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nuevo Profesor
        </Link>
      </div>

      {professors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay profesores registrados aún.</p>
          <Link
            href="/director/professors/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear tu primer profesor
          </Link>
        </div>
      ) : (
        <>
          {/* Status Filter - Only show when there are professors */}
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <label
                htmlFor="statusFilter"
                className="block text-sm font-medium text-gray-700"
              >
                Filtrar por estado:
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "active" | "inactive"
                  )
                }
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              {statusFilter !== "all" && (
                <span className="text-sm text-gray-500">
                  ({filteredProfessors.length} profesor
                  {filteredProfessors.length !== 1 ? "es" : ""})
                </span>
              )}
            </div>
          </div>

          {filteredProfessors.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">
                No hay profesores{" "}
                {statusFilter === "active" ? "activos" : "inactivos"}.
              </p>
              <button
                onClick={() => setStatusFilter("all")}
                className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
              >
                Ver todos los profesores
              </button>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {filteredProfessors.map((professor) => {
                  const fullName =
                    `${professor.first_name || ""} ${
                      professor.last_name || ""
                    }`.trim() || professor.email;
                  const subjectsList = professor.subjects
                    .map((ps) => ps.subject.name)
                    .join(", ");
                  const statusColor =
                    professor.status === "active"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800";

                  return (
                    <li key={professor.id} className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-medium text-gray-900">
                              {fullName}
                            </h3>
                            <button
                              onClick={() =>
                                handleToggleStatus(
                                  professor.id,
                                  professor.status || "active"
                                )
                              }
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80 ${statusColor}`}
                              title="Click para cambiar estado"
                            >
                              {professor.status === "active"
                                ? "Activo"
                                : "Inactivo"}
                            </button>
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Email:</span>{" "}
                              {professor.email || "N/A"}
                            </div>
                            {professor.phone && (
                              <div>
                                <span className="font-medium">Teléfono:</span>{" "}
                                {professor.phone}
                              </div>
                            )}
                            {subjectsList && (
                              <div>
                                <span className="font-medium">Materias:</span>{" "}
                                {subjectsList}
                              </div>
                            )}
                            {!subjectsList && (
                              <div className="text-gray-400 italic">
                                Sin materias asignadas
                              </div>
                            )}
                            {professor.additional_info && (
                              <div>
                                <span className="font-medium">
                                  Info adicional:
                                </span>{" "}
                                {professor.additional_info}
                              </div>
                            )}
                          </div>
                          {professor.schedules &&
                            professor.schedules.length > 0 && (
                              <div className="mt-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">
                                  Horarios Asignados:
                                </h4>
                                <div className="space-y-1">
                                  {professor.schedules.map((schedule) => (
                                    <div
                                      key={schedule.id}
                                      className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded"
                                    >
                                      <span className="font-medium">
                                        {schedule.name}
                                      </span>
                                      {" - "}
                                      <span>
                                        {DAY_NAMES[schedule.day_of_week - 1]}{" "}
                                        {schedule.start_time.substring(0, 5)} -{" "}
                                        {schedule.end_time.substring(0, 5)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          <Link
                            href={`/director/professors/${professor.id}/edit`}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            Editar
                          </Link>
                          <button
                            onClick={() => handleDelete(professor.id, fullName)}
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
