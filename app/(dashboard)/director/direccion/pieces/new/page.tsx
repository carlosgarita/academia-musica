"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSongPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const author = formData.get("author") as string;
    const difficulty_level = parseInt(formData.get("difficulty_level") as string);

    // Validation
    if (!name || !name.trim()) {
      setError("El nombre de la canci?n es requerido");
      setLoading(false);
      return;
    }

    if (isNaN(difficulty_level) || difficulty_level < 1 || difficulty_level > 5) {
      setError("El nivel de dificultad debe ser un n?mero entre 1 y 5");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/songs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          author: author?.trim() || null,
          difficulty_level,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.details
          ? `${data.error || "Error"}: ${data.details}`
          : data.error || "Error al crear la canci?n";
        throw new Error(errorMessage);
      }

      // Success
      router.push("/director/direccion/songs");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al crear la canci?n"
      );
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Canci?n</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea una nueva canci?n para tu academia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Song Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre de la Canci?n <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={200}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej: Sonata en Do Mayor, Canci?n de Cuna"
            />
            <p className="mt-1 text-xs text-gray-500">M?ximo 200 caracteres</p>
          </div>

          {/* Author */}
          <div>
            <label
              htmlFor="author"
              className="block text-sm font-medium text-gray-700"
            >
              Autor
            </label>
            <input
              type="text"
              id="author"
              name="author"
              maxLength={200}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej: Ludwig van Beethoven, Johann Sebastian Bach"
            />
            <p className="mt-1 text-xs text-gray-500">M?ximo 200 caracteres (opcional)</p>
          </div>

          {/* Difficulty Level */}
          <div>
            <label
              htmlFor="difficulty_level"
              className="block text-sm font-medium text-gray-700"
            >
              Nivel de Dificultad <span className="text-red-500">*</span>
            </label>
            <select
              id="difficulty_level"
              name="difficulty_level"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Selecciona un nivel</option>
              <option value="1">1 - Muy F?cil</option>
              <option value="2">2 - F?cil</option>
              <option value="3">3 - Intermedio</option>
              <option value="4">4 - Avanzado</option>
              <option value="5">5 - Experto</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Selecciona el nivel de dificultad de la canci?n
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creando..." : "Crear Canci?n"}
          </button>
        </div>
      </form>
    </div>
  );
}
