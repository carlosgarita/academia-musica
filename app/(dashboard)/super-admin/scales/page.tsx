"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, Plus, Pencil, Trash2 } from "lucide-react";

type Scale = {
  id: string;
  name: string;
  description?: string | null;
  numeric_value: number;
  is_default: boolean;
  display_order: number;
};

export default function SuperAdminScalesPage() {
  const [scales, setScales] = useState<Scale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/super-admin/scales");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setScales(data.scales || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar la escala "${name}"?`)) return;
    try {
      const res = await fetch(`/api/super-admin/scales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al eliminar");
      }
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) return <p className="text-gray-600">Cargando escalas...</p>;
  if (error) return <p className="text-red-600">Error: {error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escalas de calificación</h1>
          <p className="text-sm text-gray-500">Catálogo global. Asigna a academias al crearlas.</p>
        </div>
        <Link
          href="/super-admin/scales/new"
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          Nueva Escala
        </Link>
      </div>

      {scales.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-600">No hay escalas creadas.</p>
          <Link
            href="/super-admin/scales/new"
            className="mt-4 inline-flex text-indigo-600 hover:text-indigo-500"
          >
            Crear la primera escala
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scales.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-sm text-gray-500">{s.display_order}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {s.name}
                    {s.is_default && (
                      <span className="ml-2 text-xs text-gray-500">(predeterminada)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{s.numeric_value}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{s.description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/super-admin/scales/${s.id}/edit`}
                      className="text-gray-500 hover:text-gray-700 mr-3"
                    >
                      <Pencil className="h-4 w-4 inline" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
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
