"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Student = { id: string; first_name: string; last_name: string; enrollment_status?: string };
type Subject = { id: string; name: string };
type Period = { id: string; year: number; period: string };
type Song = { id: string; name: string; author: string | null; difficulty_level: number };

export default function NewCourseRegistrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [songIds, setSongIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, subjRes, pRes, soRes] = await Promise.all([
          fetch("/api/students"),
          fetch("/api/subjects"),
          fetch("/api/periods"),
          fetch("/api/songs"),
        ]);
        const sData = await sRes.json();
        const subjData = await subjRes.json();
        const pData = await pRes.json();
        const soData = await soRes.json();
        if (sRes.ok) setStudents((sData.students || []).filter((s: Student) => s.enrollment_status !== "retirado"));
        if (subjRes.ok) setSubjects(subjData.subjects || []);
        if (pRes.ok) setPeriods(pData.periods || []);
        if (soRes.ok) setSongs(soData.songs || []);
      } catch (_) {}
    })();
  }, []);

  function toggleSong(id: string) {
    setSongIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/course-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          subject_id: subjectId,
          period_id: periodId,
          song_ids: songIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.details ? `${data.error}: ${data.details}` : (data.error || "Error al crear la matrícula");
        throw new Error(msg);
      }
      router.push("/director/direccion/course-registrations");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva matrícula</h1>
        <p className="mt-1 text-sm text-gray-500">Inscribir estudiante en una clase para un periodo</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Estudiante <span className="text-red-500">*</span></label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Seleccione un estudiante</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Clase <span className="text-red-500">*</span></label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Seleccione una clase (materia)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Periodo <span className="text-red-500">*</span></label>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Seleccione un periodo</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.year}-{p.period}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Canciones (opcional)</label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2">
              {songs.length === 0 && <p className="text-sm text-gray-500">No hay canciones.</p>}
              {songs.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={songIds.includes(s.id)}
                    onChange={() => toggleSong(s.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm">{s.name}{s.author ? ` — ${s.author}` : ""} (nivel {s.difficulty_level})</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/director/direccion/course-registrations"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
