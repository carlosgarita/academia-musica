"use client";

import { useSupabase } from "@/lib/hooks/useSupabase";
import type { Database } from "@/lib/database.types";
import { useEffect, useState } from "react";

type Academy = Database["public"]["Tables"]["academies"]["Row"];

export default function AcademiesList() {
  const supabase = useSupabase();
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAcademies() {
      try {
        const { data, error } = await supabase
          .from("academies")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setAcademies(data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load academies"
        );
      } finally {
        setLoading(false);
      }
    }

    loadAcademies();
  }, [supabase]);

  if (loading) {
    return <div>Cargando academias...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="mt-8 flex flex-col">
      <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
                  >
                    Nombre
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Dirección
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Teléfono
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Sitio Web
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Estado
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                  >
                    Fecha de Creación
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {academies.map((academy) => (
                  <tr key={academy.id}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {academy.name}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {academy.address || (
                        <span className="italic text-gray-400">
                          Sin dirección
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {academy.phone || (
                        <span className="italic text-gray-400">
                          Sin teléfono
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {academy.website ? (
                        <a
                          href={
                            academy.website.startsWith("http")
                              ? academy.website
                              : `https://${academy.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          {academy.website}
                        </a>
                      ) : (
                        <span className="italic text-gray-400">
                          Sin sitio web
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <button
                        onClick={async () => {
                          const newStatus =
                            academy.status === "active" ? "inactive" : "active";
                          try {
                            const response = await fetch(
                              `/api/academies/${academy.id}/status`,
                              {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ status: newStatus }),
                              }
                            );

                            if (response.ok) {
                              // Refresh the list
                              window.location.reload();
                            } else {
                              const data = await response.json();
                              alert(
                                data.error || "Error al actualizar el estado"
                              );
                            }
                          } catch (error) {
                            console.error("Error updating status:", error);
                            alert("Error al actualizar el estado");
                          }
                        }}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          academy.status === "active"
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        }`}
                      >
                        {academy.status === "active" ? "Activa" : "Inactiva"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {new Date(academy.created_at).toLocaleDateString(
                        "es-ES",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a
                        href={`/super-admin/academies/${academy.id}/edit`}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
