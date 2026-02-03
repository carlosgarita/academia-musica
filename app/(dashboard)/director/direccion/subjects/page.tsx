"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

type Subject = {
  id: string;
  name: string;
  description: string | null;
  academy_id: string;
  created_at: string;
  updated_at: string;
};

export default function SubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    try {
      setLoading(true);
      const response = await fetch("/api/subjects");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load subjects");
      }

      setSubjects(data.subjects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading subjects");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar la materia "${name}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/subjects/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete subject");
      }

      // Reload subjects
      loadSubjects();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting subject");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando materias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materias</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona las materias disponibles en tu academia
          </p>
        </div>
        <Link
          href="/director/subjects/new"
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          Nueva Materia
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No hay materias creadas aún.</p>
          <Link
            href="/director/subjects/new"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Crear tu primera materia
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {subjects.map((subject) => (
              <li key={subject.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {subject.name}
                    </h3>
                    {subject.description && (
                      <p className="mt-2 text-sm text-gray-600">
                        {subject.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      Creada:{" "}
                      {new Date(subject.created_at).toLocaleDateString(
                        "es-ES",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </p>
                  </div>
                  <div className="ml-4 flex space-x-4">
                    <Link
                      href={`/director/subjects/${subject.id}/edit`}
                      className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(subject.id, subject.name)}
                      className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm font-normal"
                    >
                      <Trash2 className="h-4 w-4" />
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
