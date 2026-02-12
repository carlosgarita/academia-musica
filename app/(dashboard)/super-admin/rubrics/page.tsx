"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Pencil, Trash2 } from "lucide-react";

type Rubric = {
  id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  display_order: number;
};

export default function SuperAdminRubricsPage() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/super-admin/rubrics");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setRubrics(data.rubrics || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la rúbrica "${name}"?`)) return;
    try {
      const res = await fetch(`/api/super-admin/rubrics/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al eliminar");
      }
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <p className="text-gray-600">Cargando rúbricas...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rúbricas de evaluación</h1>
          <p className="text-sm text-gray-500">Catálogo global. Asigna a academias al crearlas.</p>
        </div>
        <Link
          href="/super-admin/rubrics/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          Nueva Rúbrica
        </Link>
      </div>

      {rubrics.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-600">No hay rúbricas creadas.</p>
          <Link
            href="/super-admin/rubrics/new"
            className="mt-4 inline-flex text-indigo-600 hover:text-indigo-500"
          >
            Crear la primera rúbrica
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rubrics.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.display_order}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {r.name}
                    {r.is_default && (
                      <span className="ml-2 text-xs text-gray-500">(predeterminada)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super-admin/rubrics/${r.id}/edit`}
                      className="text-gray-500 hover:text-gray-700 mr-3"
                    >
                      <Pencil className="h-4 w-4 inline" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id, r.name)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
