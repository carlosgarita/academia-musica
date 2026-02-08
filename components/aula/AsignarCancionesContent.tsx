"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

type Song = {
  id: string;
  name: string;
  author: string | null;
  difficulty_level: number;
};

type CourseRegistration = {
  id: string;
  student_id: string;
  status?: string | null;
  student?: { first_name: string; last_name: string } | null;
  songs?: Song[];
};

type Course = {
  id: string;
  subject?: { name?: string } | null;
  period?: { year?: number; period?: string } | null;
};

interface AsignarCancionesContentProps {
  basePath: string;
  professorId: string;
}

function getDifficultyLabel(level: number) {
  const labels = ["", "Muy Fácil", "Fácil", "Intermedio", "Avanzado", "Experto"];
  return labels[level] || level.toString();
}

export function AsignarCancionesContent({
  basePath,
  professorId,
}: AsignarCancionesContentProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const [songsByReg, setSongsByReg] = useState<Record<string, Song[]>>({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [coursesRes, songsRes] = await Promise.all([
          fetch(`/api/courses?profile_id=${professorId}`),
          fetch("/api/songs"),
        ]);
        const coursesData = await coursesRes.json();
        const songsData = await songsRes.json();
        const list = (coursesData.courses || []).filter((c: Course) => {
          const per = Array.isArray(c.period) ? c.period[0] : c.period;
          const year = (per as { year?: number } | null)?.year;
          const currentYear = new Date().getFullYear();
          return year != null && year >= currentYear - 1;
        });
        setCourses(list);
        setAllSongs(songsData.songs || []);
      } catch {
        setCourses([]);
        setAllSongs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [professorId]);

  useEffect(() => {
    if (!selectedCourseId) {
      setRegistrations([]);
      setSongsByReg({});
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/course-registrations?course_id=${selectedCourseId}`
        );
        const data = await res.json();
        const regs = (data.courseRegistrations || []).filter(
          (r: CourseRegistration) => r.status === "active"
        );
        setRegistrations(regs);

        const songsMap: Record<string, Song[]> = {};
        await Promise.all(
          regs.map(async (r: CourseRegistration) => {
            const sRes = await fetch(
              `/api/course-registrations/${r.id}/songs`
            );
            const sData = await sRes.json();
            songsMap[r.id] = sData.songs || [];
          })
        );
        setSongsByReg(songsMap);
      } catch {
        setRegistrations([]);
        setSongsByReg({});
      }
    })();
  }, [selectedCourseId]);

  async function assignSong(registrationId: string) {
    if (!selectedSongId) return;
    setAssigning(registrationId);
    try {
      const res = await fetch(
        `/api/course-registrations/${registrationId}/songs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ song_ids: [selectedSongId] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al asignar");
      setSongsByReg((prev) => ({
        ...prev,
        [registrationId]: data.songs || [],
      }));
      setSelectedSongId("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error al asignar");
    } finally {
      setAssigning(null);
    }
  }

  async function removeSong(registrationId: string, songId: string) {
    try {
      const res = await fetch(
        `/api/course-registrations/${registrationId}/songs/${songId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al quitar");
      }
      setSongsByReg((prev) => ({
        ...prev,
        [registrationId]: (prev[registrationId] || []).filter(
          (s) => s.id !== songId
        ),
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-gray-600">
        Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Asignar Canciones</h1>
        <p className="mt-1 text-sm text-gray-500">
          Asigna canciones a los estudiantes matriculados en tus cursos
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-4">
        <label
          htmlFor="course-filter"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Filtrar por curso
        </label>
        <select
          id="course-filter"
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="">Selecciona un curso...</option>
          {courses.map((c) => {
            const subj = Array.isArray(c.subject) ? c.subject[0] : c.subject;
            const per = Array.isArray(c.period) ? c.period[0] : c.period;
            const name = subj?.name || "Curso";
            const periodStr = per ? `${per.year} – ${per.period}` : "";
            return (
              <option key={c.id} value={c.id}>
                {name} {periodStr}
              </option>
            );
          })}
        </select>
      </div>

      {!selectedCourseId ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Selecciona un curso para ver los estudiantes matriculados.
        </div>
      ) : registrations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No hay estudiantes matriculados en este curso.
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {registrations.map((reg) => {
              const studentName = reg.student
                ? `${reg.student.first_name || ""} ${reg.student.last_name || ""}`.trim()
                : "—";
              const isExpanded = expandedRegId === reg.id;
              const assigned = songsByReg[reg.id] || [];
              const existingIds = new Set(assigned.map((s) => s.id));
              const availableSongs = allSongs.filter((s) => !existingIds.has(s.id));

              return (
                <li key={reg.id} className="border-b border-gray-200 last:border-b-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRegId((p) => (p === reg.id ? null : reg.id))
                    }
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    <span className="text-lg font-medium text-gray-900">
                      {studentName}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 pl-8 bg-gray-50/50 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Seleccionar canción para asignar
                        </label>
                        <select
                          value={selectedSongId}
                          onChange={(e) => setSelectedSongId(e.target.value)}
                          className="block w-full max-w-md rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="">
                            — Selecciona una canción —
                          </option>
                          {availableSongs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                              {s.author ? ` — ${s.author}` : ""} · Nivel:{" "}
                              {getDifficultyLabel(s.difficulty_level)}
                            </option>
                          ))}
                          {availableSongs.length === 0 && (
                            <option value="" disabled>
                              No hay más canciones disponibles
                            </option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => assignSong(reg.id)}
                          disabled={!selectedSongId || assigning === reg.id}
                          className="mt-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {assigning === reg.id
                            ? "Asignando..."
                            : "Asignar Canción"}
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Canciones asignadas
                        </p>
                        {assigned.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            No hay canciones asignadas aún.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {assigned.map((s) => (
                              <li
                                key={s.id}
                                className="flex justify-between items-center py-1 text-sm"
                              >
                                <span>
                                  {s.name}
                                  {s.author ? ` — ${s.author}` : ""} · Nivel:{" "}
                                  {getDifficultyLabel(s.difficulty_level)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeSong(reg.id, s.id)}
                                  className="text-gray-500 hover:text-red-600 text-sm"
                                >
                                  Quitar
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div>
        <Link
          href={basePath}
          className="text-sm text-indigo-600 hover:text-indigo-900"
        >
          ← Volver a Canciones
        </Link>
      </div>
    </div>
  );
}
