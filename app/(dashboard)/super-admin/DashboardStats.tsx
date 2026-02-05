"use client";

import Link from "next/link";
import { useSupabase } from "@/lib/hooks/useSupabase";
import type { Database } from "@/lib/database.types";
import { useEffect, useState } from "react";

type Academy = Database["public"]["Tables"]["academies"]["Row"];

export default function DashboardStats() {
  const supabase = useSupabase();
  const [stats, setStats] = useState({
    academiesCount: 0,
    usersCount: 0,
    recentAcademies: [] as Academy[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        // Get academies count
        const { count: academiesCount } = await supabase
          .from("academies")
          .select("*", { count: "exact", head: true });

        // Get users count
        const { count: usersCount } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        // Get recent academies
        const { data: recentAcademies } = await supabase
          .from("academies")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        setStats({
          academiesCount: academiesCount || 0,
          usersCount: usersCount || 0,
          recentAcademies: recentAcademies || [],
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load statistics"
        );
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [supabase]);

  if (loading) {
    return <div>Loading statistics...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Academies
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {stats.academiesCount}
            </dd>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Users
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {stats.usersCount}
            </dd>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Recent Academies
          </h3>
          <div className="mt-4">
            <div className="flow-root">
              <ul role="list" className="-my-5 divide-y divide-gray-200">
                {stats.recentAcademies.map((academy) => (
                  <li key={academy.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {academy.name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          Created:{" "}
                          {new Date(academy.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <a
                          href={`/super-admin/academies/${academy.id}`}
                          className="inline-flex items-center shadow-sm px-2.5 py-0.5 border border-gray-300 text-sm leading-5 font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">
              <Link
                href="/super-admin/academies"
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                View all academies
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
