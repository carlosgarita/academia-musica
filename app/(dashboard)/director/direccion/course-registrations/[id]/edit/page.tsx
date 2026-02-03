"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Song = {
  id: string;
  name: string;
  author: string | null;
  difficulty_level: number;
};

export default function EditCourseRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reg, setReg] = useState<{
    id: string;
    student_id: string;
    subject_id: string;
    period_id: string;
    status: string;
    student?: { first_name: string; last_name: string } | null;
    subject?: { name: string } | null;
    period?: { year: number; period: string } | null;
    songs: Song[];
  } | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState("active");

  useEffect(() => {
    (async () => {
      try {
        const [rRes, sRes] = await Promise.all([
          fetch(`/api/course-registrations/${id}`),
          fetch("/api/songs"),
        ]);
        const rData = await rRes.json();
        const sData = await sRes.json();
        if (!rRes.ok)
          throw new Error(rData.error || "No se encontró la matrícula");
        setReg(rData.courseRegistration);
        setStatus(rData.courseRegistration?.status || "active");
        if (sRes.ok) setAllSongs(sData.songs || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function addSongs(ids: string[]) {
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/course-registrations/${id}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ song_ids: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar canciones");
      setReg((r) => (r ? { ...r, songs: data.songs || r.songs } : null));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function removeSong(songId: string) {
    try {
      const res = await fetch(
        `/api/course-registrations/${id}/songs/${songId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al quitar la canción");
      }
      setReg((r) =>
        r ? { ...r, songs: r.songs.filter((s) => s.id !== songId) } : null
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  async function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/course-registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al actualizar");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const existingIds = new Set(reg?.songs.map((s) => s.id) || []);
  const toAdd = allSongs.filter((s) => !existingIds.has(s.id));
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

  function toggleToAdd(songId: string) {
    setSelectedToAdd((p) =>
      p.includes(songId) ? p.filter((x) => x !== songId) : [...p, songId]
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando…</div>
      </div>
    );
  }

  if (error && !reg) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <Link
          href="/director/direccion/course-registrations"
          className="text-indigo-600 hover:text-indigo-900"
        >
          Volver a matrículas
        </Link>
      </div>
    );
  }

  if (!reg) return null;

  const sn = reg.student
    ? `${reg.student.first_name} ${reg.student.last_name}`.trim()
    : "—";
  const cl = reg.subject?.name || "—";
  const pd = reg.period ? `${reg.period.year}-${reg.period.period}` : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar matrícula</h1>
        <p className="mt-1 text-sm text-gray-500">
          {sn} · {cl} · {pd}
        </p>
      </div>

      <form
        onSubmit={handleStatusSubmit}
        className="bg-white shadow rounded-lg p-6"
      >
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Estado
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="active">Activa</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar estado"}
          </button>
        </div>
      </form>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Canciones asignadas
        </h2>

        {reg.songs.length > 0 && (
          <ul className="divide-y divide-gray-200 mb-6">
            {reg.songs.map((s) => (
              <li key={s.id} className="py-2 flex justify-between items-center">
                <span className="text-sm">
                  {s.name}
                  {s.author ? ` — ${s.author}` : ""} (nivel {s.difficulty_level}
                  )
                </span>
                <button
                  type="button"
                  onClick={() => removeSong(s.id)}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        {toAdd.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Agregar canciones
            </p>
            <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2 mb-4">
              {toAdd.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedToAdd.includes(s.id)}
                    onChange={() => toggleToAdd(s.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">
                    {s.name}
                    {s.author ? ` — ${s.author}` : ""}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                addSongs(selectedToAdd);
                setSelectedToAdd([]);
              }}
              disabled={selectedToAdd.length === 0}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              Agregar seleccionadas
            </button>
          </div>
        )}

        {reg.songs.length === 0 && toAdd.length === 0 && (
          <p className="text-sm text-gray-500">
            No hay canciones disponibles para agregar.
          </p>
        )}
      </div>

      <div>
        <Link
          href="/director/direccion/course-registrations"
          className="text-indigo-600 hover:text-indigo-900 text-sm"
        >
          ← Volver a matrículas
        </Link>
      </div>
    </div>
  );
}
