"use client";

import { useEffect, useState } from "react";
import { useDatabase } from "@/lib/hooks/useDatabase";
import type { Database } from "@/lib/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface DashboardStatsProps {
  studentId: string;
}

export function DashboardStats({ studentId }: DashboardStatsProps) {
  const db = useDatabase();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalAssignments: 0,
    completedAssignments: 0,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        // TODO: Add getStudentStats function to get assignments and progress
        // For now, we'll show placeholder stats
        setStats({
          totalAssignments: 0,
          completedAssignments: 0,
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
  }, [studentId, db]);

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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  Tareas Completadas
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  {stats.completedAssignments} / {stats.totalAssignments}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
