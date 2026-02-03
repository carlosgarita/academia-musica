"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Song = {
  id: string;
  name: string;
  author: string | null;
  difficulty_level: number;
  academy_id: string;
  created_at: string;
  updated_at: string;
};

export default function SongsPage() {
  const router = useRouter();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, []);

  async function loadSongs() {
    try {
      setLoading(true);
      const response = await fetch("/api/songs");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load songs");
      }

      setSongs(data.songs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading songs");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar la canción "${name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/songs/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete song");
      }

      // Reload songs
      loadSongs();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting song");
    }
  }

  const getDifficultyLabel = (level: number) => {
    const labels = [
      "",
      "Muy Fácil",
      "Fácil",
      "Intermedio",
      "Avanzado",
      "Experto",
    ];
    return labels[level] || level.toString();
  };

  const getDifficultyColor = (level: number) => {
    const colors = [
      "",
      "bg-green-100 text-green-800",
      "bg-blue-100 text-blue-800",
      "bg-yellow-100 text-yellow-800",
      "bg-orange-100 text-orange-800",
      "bg-red-100 text-red-800",
    ];
    return colors[level] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando canciones...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Canciones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona las canciones disponibles en tu academia
          </p>
        </div>
        <Link
          href="/director/direccion/songs/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nueva Canción
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {songs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay canciones creadas aún.</p>
          <Link
            href="/director/direccion/songs/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear tu primera canción
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {songs.map((song) => (
              <li key={song.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-medium text-gray-900">
                        {song.name}
                      </h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDifficultyColor(
                          song.difficulty_level
                        )}`}
                      >
                        Nivel {song.difficulty_level}:{" "}
                        {getDifficultyLabel(song.difficulty_level)}
                      </span>
                    </div>
                    {song.author && (
                      <p className="mt-2 text-sm text-gray-600">
                        Autor: {song.author}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      Creada:{" "}
                      {new Date(song.created_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <Link
                      href={`/director/direccion/songs/${song.id}/edit`}
                      className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(song.id, song.name)}
                      className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
