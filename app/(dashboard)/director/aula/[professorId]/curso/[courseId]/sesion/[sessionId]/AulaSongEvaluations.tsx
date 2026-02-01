"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Music } from "lucide-react";

type Song = { id: string; name: string; author?: string | null };
type Rubric = { id: string; name: string };
type Scale = { id: string; name: string };

const EVAL_KEY = (regId: string, songId: string, rubricId: string) =>
  `${regId}:${songId}:${rubricId}`;

export function AulaSongEvaluations({
  registrationId,
  sessionId,
  subjectId,
  academyId,
  onSnackbar,
}: {
  registrationId: string;
  sessionId: string;
  subjectId: string;
  academyId: string;
  onSnackbar: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [scales, setScales] = useState<Scale[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!expanded) return;
    setLoading(true);
    try {
      const [songsRes, evalDataRes, evaluationsRes] = await Promise.all([
        fetch(`/api/course-registrations/${registrationId}/songs`),
        fetch(`/api/evaluation-data?academy_id=${encodeURIComponent(academyId)}&subject_id=${encodeURIComponent(subjectId)}`),
        fetch(`/api/song-evaluations?period_date_id=${encodeURIComponent(sessionId)}&course_registration_id=${encodeURIComponent(registrationId)}`),
      ]);

      const songsData = await songsRes.json();
      if (songsRes.ok && songsData.songs) {
        setSongs(songsData.songs);
      }

      const evalData = await evalDataRes.json();
      if (evalDataRes.ok) {
        setRubrics(evalData.rubrics || []);
        setScales(evalData.scales || []);
      }

      const evData = await evaluationsRes.json();
      if (evaluationsRes.ok && evData.evaluations) {
        setEvaluations(evData.evaluations);
      }
    } catch (e) {
      console.error("Error loading song evaluations:", e);
    } finally {
      setLoading(false);
    }
  }, [expanded, registrationId, sessionId, academyId, subjectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScaleChange = async (songId: string, rubricId: string, scaleId: string) => {
    const key = EVAL_KEY(registrationId, songId, rubricId);
    setEvaluations((prev) => ({ ...prev, [key]: scaleId }));
    setSaving(key);
    try {
      const r = await fetch("/api/song-evaluations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_registration_id: registrationId,
          song_id: songId,
          period_date_id: sessionId,
          rubric_id: rubricId,
          scale_id: scaleId || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al guardar");
      }
      onSnackbar("Calificación guardada");
    } catch (e) {
      console.error("Error saving evaluation:", e);
    } finally {
      setSaving(null);
    }
  };

  const getScaleId = (songId: string, rubricId: string) =>
    evaluations[EVAL_KEY(registrationId, songId, rubricId)] ?? "";

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <ChevronDown className="h-4 w-4" />
        Calificar canciones
      </button>
    );
  }

  return (
    <div className="mt-2 w-full basis-full shrink-0 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
      >
        <ChevronUp className="h-4 w-4" />
        Ocultar calificaciones
      </button>
      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : songs.length === 0 ? (
        <p className="text-sm text-gray-500">No hay canciones asignadas.</p>
      ) : rubrics.length === 0 ? (
        <p className="text-sm text-gray-500">No hay rubros de evaluación configurados. Configura rubros en la materia.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-4 text-left font-medium text-gray-700">Canción</th>
                {rubrics.map((r) => (
                  <th key={r.id} className="py-2 px-2 text-left font-medium text-gray-700 whitespace-nowrap">
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {songs.map((song) => (
                <tr key={song.id}>
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      <Music className="h-4 w-4 text-gray-400 shrink-0" />
                      <span className="font-medium text-gray-900">{song.name}</span>
                    </div>
                    {song.author && (
                      <p className="text-xs text-gray-500 mt-0.5">{song.author}</p>
                    )}
                  </td>
                  {rubrics.map((rubric) => (
                    <td key={rubric.id} className="py-2 px-2">
                      <select
                        value={getScaleId(song.id, rubric.id)}
                        onChange={(e) => handleScaleChange(song.id, rubric.id, e.target.value)}
                        disabled={saving !== null}
                        className="block w-full max-w-[180px] rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                      >
                        <option value="">—</option>
                        {scales.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
