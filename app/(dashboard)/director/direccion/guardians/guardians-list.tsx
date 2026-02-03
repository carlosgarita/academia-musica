"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

type Guardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  academy_id: string;
  additional_info: string | null;
  created_at: string;
  updated_at: string;
  students: Array<{
    student: {
      id: string;
      name: string;
      enrollment_status: string;
    };
  }>;
};

interface GuardiansListProps {
  academyId: string;
}

export function GuardiansList({ academyId }: GuardiansListProps) {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("active");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    loadGuardians();
  }, []);

  async function loadGuardians() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/guardians");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load guardians");
      }

      setGuardians(data.guardians || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar los encargados"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar al encargado "${name}"? Esta acción eliminará también su cuenta de usuario.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/guardians/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete guardian");
      }

      // Reload guardians
      loadGuardians();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting guardian");
    }
  }

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";

    try {
      const response = await fetch(`/api/guardians/${id}/status`, {
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

      // Reload guardians
      loadGuardians();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error updating status");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando encargados...</div>
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
  const formatName = (
    firstName: string | null,
    lastName: string | null,
    email?: string
  ): string => {
    const first = firstName || "";
    const last = lastName || "";
    if (last && first) {
      return `${last} ${first}`.trim();
    }
    if (last) return last;
    if (first) return first;
    return email || "Sin nombre";
  };

  // Filter and sort guardians by last name
  const filteredGuardians = guardians
    .filter((guardian) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "active") return guardian.status === "active";
      if (statusFilter === "inactive") return guardian.status === "inactive";
      return true;
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
          <h1 className="text-2xl font-bold text-gray-900">Encargados</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los encargados de los estudiantes
          </p>
        </div>
        <Link
          href="/director/guardians/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nuevo Encargado
        </Link>
      </div>

      {guardians.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay encargados registrados aún.</p>
          <Link
            href="/director/guardians/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear tu primer encargado
          </Link>
        </div>
      ) : (
        <>
          {/* Status Filter - Only show when there are guardians */}
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
                  ({filteredGuardians.length} encargado
                  {filteredGuardians.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>
          </div>

          {filteredGuardians.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-500">
                No hay encargados{" "}
                {statusFilter === "active" ? "activos" : "inactivos"}.
              </p>
              <button
                onClick={() => setStatusFilter("all")}
                className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
              >
                Ver todos los encargados
              </button>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {filteredGuardians.map((guardian) => {
                  const fullName = formatName(
                    guardian.first_name,
                    guardian.last_name,
                    guardian.email
                  );
                  const studentsList = guardian.students
                    .map((gs) => {
                      const s = gs.student as
                        | {
                            first_name?: string;
                            last_name?: string;
                            name?: string;
                          }
                        | undefined;
                      if (!s) return "—";
                      return (
                        formatName(
                          s.first_name ?? null,
                          s.last_name ?? null,
                          s.name ?? undefined
                        ) || "—"
                      );
                    })
                    .join(", ");
                  const isExpanded = expandedIds.has(guardian.id);

                  return (
                    <li
                      key={guardian.id}
                      className="border-b border-gray-200 last:border-b-0"
                    >
                      <div className="flex justify-between items-center px-4 py-3 hover:bg-gray-50">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(guardian.id)}
                          className="flex items-center gap-2 flex-1 text-left min-w-0"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                          )}
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {fullName}
                          </h3>
                        </button>
                        <div className="ml-4 flex items-center gap-4 shrink-0">
                          <Link
                            href={`/director/guardians/${guardian.id}/edit`}
                            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(guardian.id, fullName);
                            }}
                            className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 pl-12 bg-gray-50/50">
                          <div className="space-y-1 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Email:</span>{" "}
                              {guardian.email || "N/A"}
                            </div>
                            {guardian.phone && (
                              <div>
                                <span className="font-medium">Teléfono:</span>{" "}
                                {guardian.phone}
                              </div>
                            )}
                            {guardian.additional_info && (
                              <div>
                                <span className="font-medium">
                                  Info adicional:
                                </span>{" "}
                                {guardian.additional_info}
                              </div>
                            )}
                            {guardian.students &&
                            guardian.students.length > 0 ? (
                              <div>
                                <span className="font-medium">
                                  Estudiantes:
                                </span>{" "}
                                {studentsList}
                              </div>
                            ) : (
                              <div className="text-gray-400 italic">
                                Sin estudiantes asignados
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
