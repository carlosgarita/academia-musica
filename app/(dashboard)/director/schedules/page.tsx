"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Schedule = {
  id: string;
  name: string;
  profile_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_id: string;
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
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

export default function SchedulesPage() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      setLoading(true);
      const response = await fetch("/api/schedules");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load schedules");
      }

      setSchedules(data.schedules || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading schedules");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de que deseas eliminar este horario?")) {
      return;
    }

    try {
      const response = await fetch(`/api/schedules/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete schedule");
      }

      // Reload schedules
      loadSchedules();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting schedule");
    }
  }

  // Group schedules by name (same class, different days)
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.name]) {
      acc[schedule.name] = [];
    }
    acc[schedule.name].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando horarios...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horarios</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los horarios de clases de tu academia
          </p>
        </div>
        <Link
          href="/director/schedules/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nuevo Horario
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay horarios creados aún.</p>
          <Link
            href="/director/schedules/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear tu primer horario
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {Object.entries(groupedSchedules).map(
              ([className, classSchedules]) => (
                <li key={className} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {className}
                      </h3>
                      <div className="mt-2 space-y-1">
                        {classSchedules.map((schedule) => (
                          <div
                            key={schedule.id}
                            className="flex items-center text-sm text-gray-600"
                          >
                            <span className="font-medium w-24">
                              {DAY_NAMES[schedule.day_of_week - 1]}:
                            </span>
                            <span>
                              {schedule.start_time.substring(0, 5)} -{" "}
                              {schedule.end_time.substring(0, 5)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm text-gray-500">
                        Profesor:{" "}
                        {classSchedules[0].profile
                          ? `${classSchedules[0].profile.first_name || ""} ${
                              classSchedules[0].profile.last_name || ""
                            }`.trim() || classSchedules[0].profile.email
                          : "Sin nombre"}
                      </div>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <Link
                        href={`/director/schedules/${classSchedules[0].id}/edit`}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Editar
                      </Link>
                      <button
                        onClick={() => {
                          // Delete all schedules with this name
                          classSchedules.forEach((s) => handleDelete(s.id));
                        }}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
