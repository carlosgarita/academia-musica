"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Song = {
  id: string;
  name: string;
  author: string | null;
  difficulty_level: number;
  academy_id: string;
  created_at: string;
  updated_at: string;
};

interface EditSongFormProps {
  songId: string;
  basePath: string;
}

export function EditSongForm({ songId, basePath }: EditSongFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(null);

  useEffect(() => {
    if (songId) {
      loadSong();
    }
  }, [songId]);

  async function loadSong() {
    try {
      setLoading(true);
      const response = await fetch(`/api/songs/${songId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load song");
      }

      setSong(data.song);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading song");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!song) return;

    setError(null);
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const author = formData.get("author") as string;
    const difficulty_level = parseInt(formData.get("difficulty_level") as string);

    if (!name || !name.trim()) {
      setError("El nombre de la canción es requerido");
      setSubmitting(false);
      return;
    }

    if (isNaN(difficulty_level) || difficulty_level < 1 || difficulty_level > 5) {
      setError("El nivel de dificultad debe ser un número entre 1 y 5");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/songs/${songId}`, {
        method: "PATCH",
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
          : data.error || "Error al actualizar la canción";
        throw new Error(errorMessage);
      }

      router.push(basePath);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al actualizar la canción"
      );
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando canción...</div>
      </div>
    );
  }

  if (error && !song) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          onClick={() => router.push(basePath)}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Volver
        </button>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Canción no encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar Canción</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modifica la información de la canción
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre de la Canción <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={200}
              defaultValue={song.name}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej: Sonata en Do Mayor, Canción de Cuna"
            />
            <p className="mt-1 text-xs text-gray-500">Máximo 200 caracteres</p>
          </div>

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
              defaultValue={song.author || ""}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej: Ludwig van Beethoven, Johann Sebastian Bach"
            />
            <p className="mt-1 text-xs text-gray-500">Máximo 200 caracteres (opcional)</p>
          </div>

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
              defaultValue={song.difficulty_level}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="1">1 - Muy Fácil</option>
              <option value="2">2 - Fácil</option>
              <option value="3">3 - Intermedio</option>
              <option value="4">4 - Avanzado</option>
              <option value="5">5 - Experto</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Selecciona el nivel de dificultad de la canción
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.push(basePath)}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
