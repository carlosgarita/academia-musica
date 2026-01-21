"use client";

import { useEffect, useState } from "react";
import { useDatabase } from "@/lib/hooks/useDatabase";
import type { Database } from "@/lib/database.types";

type Professor = Database["public"]["Tables"]["professors"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];

interface DashboardStatsProps {
  academyId: string;
}

export function DashboardStats({ academyId }: DashboardStatsProps) {
  const db = useDatabase();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalProfessors: 0,
    totalStudents: 0,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        // Load professors
        const { data: professors, error: professorsError } =
          await db.getProfessors(academyId);
        if (professorsError) throw professorsError;

        // Load students
        const { data: students, error: studentsError } = await db.getStudents(
          academyId
        );
        if (studentsError) throw studentsError;

        setStats({
          totalProfessors: professors.length || 0,
          totalStudents: students?.length || 0,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Error al cargar las estadísticas"
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadStats();
  }, [academyId, db]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Cargando estadísticas...</p>
      </div>
    );
  }

  if (error) {
    return <div className="bg-red-50 text-red-500 p-4 rounded-md">{error}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Profesores
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.totalProfessors}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Total Estudiantes
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.totalStudents}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
