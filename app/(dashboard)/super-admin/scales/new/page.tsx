"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewScalePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [numeric_value, setNumericValue] = useState(0);
  const [is_default, setIsDefault] = useState(false);
  const [display_order, setDisplayOrder] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/super-admin/scales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          numeric_value,
          is_default,
          display_order,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear");
      router.push("/super-admin/scales");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Nueva Escala de Calificación</h1>
        <p className="text-sm text-gray-500">Crear escala en el catálogo global</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre *</label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Completamente Satisfactorio"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Valor numérico *</label>
          <input
            type="number"
            required
            value={numeric_value}
            onChange={(e) => setNumericValue(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">Usado para ordenar y calcular promedios (ej. 0-3)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_default"
            checked={is_default}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="is_default" className="text-sm text-gray-700">Predeterminada</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Orden</label>
          <input
            type="number"
            min={0}
            value={display_order}
            onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Link
            href="/super-admin/scales"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Escala"}
          </button>
        </div>
      </form>
    </div>
  );
}
