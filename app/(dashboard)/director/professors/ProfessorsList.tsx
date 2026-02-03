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

export default function ProfessorsList() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfessors() {
      try {
        const response = await fetch("/api/professors");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load professors");
        }

        setProfessors(data.professors || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load professors"
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfessors();
  }, []);

  if (loading) {
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

  // Sort professors by last name
  const sortedProfessors = [...professors].sort((a, b) => {
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
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {sortedProfessors.map((professor) => {
              const fullName = formatName(
                professor.first_name,
                professor.last_name,
                professor.email
              );
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
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
                        >
                          {professor.status === "active"
                            ? "Activo"
                            : "Inactivo"}
                        </span>
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
                            {subjectsList || "Sin materias asignadas"}
                          </div>
                        )}
                        {professor.additional_info && (
                          <div>
                            <span className="font-medium">Info adicional:</span>{" "}
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
                    <div className="ml-4">
                      <Link
                        href={`/director/professors/${professor.id}/edit`}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Editar
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
