"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  MessageSquare,
  Award,
  ClipboardList,
  Music,
  ArrowLeft,
  Plus,
  X,
} from "lucide-react";

type Song = {
  id: string;
  name: string;
  author?: string | null;
  difficulty_level?: string | null;
};

type Badge = {
  id: string;
  badge_id: string;
  name: string;
  virtud?: string | null;
  description?: string | null;
  frase?: string | null;
  image_url?: string | null;
  notes?: string | null;
  assigned_at: string;
};

type CourseRegistrationData = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  academy_id?: string;
  student?: { id: string; first_name: string; last_name: string };
  subject?: { id: string; name: string };
  period?: { id: string; year: number; period: string };
  songs: Song[];
};

export function ExpedienteContent({
  registrationId,
  courseId,
  professorId,
}: {
  registrationId: string;
  courseId: string;
  professorId: string;
}) {
  const [data, setData] = useState<CourseRegistrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignedBadges, setAssignedBadges] = useState<Badge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<{ id: string; name: string; virtud?: string | null; description?: string | null; frase?: string | null; image_url?: string | null }[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(false);
  const [assigningBadgeId, setAssigningBadgeId] = useState<string | null>(null);
  const [removingBadgeId, setRemovingBadgeId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const showSnackbar = (message: string) => {
    setSnackbar({ show: true, message });
    setTimeout(() => setSnackbar((s) => ({ ...s, show: false })), 3000);
  };

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/course-registrations/${registrationId}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error al cargar expediente");
        setData(d.courseRegistration || null);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar expediente");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [registrationId]);

  useEffect(() => {
    if (!data?.academy_id || !registrationId) return;
    async function loadBadges() {
      setBadgesLoading(true);
      try {
        const [assignedRes, availableRes] = await Promise.all([
          fetch(`/api/student-badges?course_registration_id=${encodeURIComponent(registrationId)}`),
          fetch(`/api/badges?academy_id=${encodeURIComponent(data!.academy_id)}`),
        ]);
        const assignedData = await assignedRes.json();
        const availableData = await availableRes.json();
        if (assignedRes.ok && assignedData.badges) setAssignedBadges(assignedData.badges);
        if (availableRes.ok && availableData.badges) setAvailableBadges(availableData.badges);
      } catch (e) {
        console.error("Error loading badges:", e);
      } finally {
        setBadgesLoading(false);
      }
    }
    loadBadges();
  }, [data?.academy_id, registrationId]);

  const handleAssignBadge = async (badgeId: string) => {
    setAssigningBadgeId(badgeId);
    try {
      const r = await fetch("/api/student-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_registration_id: registrationId, badge_id: badgeId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al asignar");
      const badge = availableBadges.find((b) => b.id === badgeId);
      if (badge) {
        setAssignedBadges((prev) => [...prev, { id: crypto.randomUUID(), badge_id: badgeId, name: badge.name, virtud: badge.virtud, description: badge.description, frase: badge.frase, image_url: badge.image_url, notes: null, assigned_at: new Date().toISOString() }]);
        showSnackbar("Badge asignado");
      }
    } catch (e) {
      console.error("Error assigning badge:", e);
      showSnackbar(e instanceof Error ? e.message : "Error al asignar badge");
    } finally {
      setAssigningBadgeId(null);
    }
  };

  const handleRemoveBadge = async (badgeId: string) => {
    setRemovingBadgeId(badgeId);
    try {
      const r = await fetch(`/api/student-badges?course_registration_id=${encodeURIComponent(registrationId)}&badge_id=${encodeURIComponent(badgeId)}`, { method: "DELETE" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al quitar");
      }
      setAssignedBadges((prev) => prev.filter((b) => b.badge_id !== badgeId));
      showSnackbar("Badge quitado");
    } catch (e) {
      console.error("Error removing badge:", e);
      showSnackbar(e instanceof Error ? e.message : "Error al quitar badge");
    } finally {
      setRemovingBadgeId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-sm">Cargando expediente...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-amber-600 text-sm">{error ?? "Expediente no encontrado"}</p>
        <Link
          href={`/director/aula/${professorId}/curso/${courseId}`}
          className="inline-flex items-center gap-2 mt-4 text-sm text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al curso
        </Link>
      </div>
    );
  }

  const periodLabel = data.period
    ? `${data.period.year} - Período ${data.period.period}`
    : "";

  return (
    <div className="space-y-6">
      <Link
        href={`/director/aula/${professorId}/curso/${courseId}`}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al curso
      </Link>

      {/* Canciones asignadas */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Music className="h-5 w-5 text-gray-500" />
          Canciones asignadas
        </h2>
        {data.songs && data.songs.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {data.songs.map((song) => (
              <li
                key={song.id}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-medium text-gray-900">{song.name}</p>
                  {song.author && (
                    <p className="text-sm text-gray-500">{song.author}</p>
                  )}
                </div>
                {song.difficulty_level && (
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 shrink-0">
                    {song.difficulty_level}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-sm">
            No hay canciones asignadas. Asigna canciones desde Dirección →
            Matrículas.
          </p>
        )}
      </div>

      {/* Calificaciones (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-500" />
          Calificaciones por sesión
        </h2>
        <p className="text-sm text-gray-500">
          Las calificaciones por rubro y sesión se mostrarán aquí cuando estén
          disponibles.
        </p>
      </div>

      {/* Comentarios del profesor (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          Comentarios del profesor
        </h2>
        <p className="text-sm text-gray-500">
          Los comentarios por sesión se mostrarán aquí.
        </p>
      </div>

      {/* Tareas (placeholder) */}
      <div className="bg-white rounded-lg shadow p-6 border border-dashed border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-gray-500" />
          Tareas
        </h2>
        <p className="text-sm text-gray-500">
          Tareas individuales y grupales del curso.
        </p>
      </div>

      {/* Badges */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-gray-500" />
          Badges
        </h2>
        {badgesLoading ? (
          <p className="text-sm text-gray-500">Cargando badges...</p>
        ) : (
          <>
            {assignedBadges.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Asignados</h3>
                <div className="flex flex-wrap gap-3">
                  {assignedBadges.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      {b.image_url.startsWith("http") ? (
                        <img src={b.image_url} alt={b.name} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                          <Award className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{b.name}</p>
                        {b.description && <p className="text-xs text-gray-500">{b.description}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBadge(b.badge_id)}
                        disabled={removingBadgeId !== null}
                        className="ml-1 text-red-500 hover:text-red-600 disabled:opacity-50"
                        title="Quitar badge"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {availableBadges.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {assignedBadges.length > 0 ? "Asignar más" : "Disponibles"}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {availableBadges
                    .filter((b) => !assignedBadges.some((ab) => ab.badge_id === b.id))
                    .map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleAssignBadge(b.id)}
                        disabled={assigningBadgeId !== null}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                      >
                        {b.image_url?.startsWith("http") ? (
                          <img src={b.image_url} alt={b.name} className="h-10 w-10 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                            <Award className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        <div className="text-left">
                          <p className="font-medium text-gray-900 text-sm">{b.name}</p>
                          {b.virtud && <p className="text-xs text-indigo-600 font-medium">{b.virtud}</p>}
                          {b.description && <p className="text-xs text-gray-500 line-clamp-1">{b.description}</p>}
                        </div>
                        <Plus className="h-4 w-4 text-indigo-600 shrink-0" />
                      </button>
                    ))}
                  {availableBadges.filter((b) => !assignedBadges.some((ab) => ab.badge_id === b.id)).length === 0 &&
                    assignedBadges.length > 0 && (
                      <p className="text-sm text-gray-500">Todos los badges disponibles ya están asignados.</p>
                    )}
                </div>
              </div>
            )}
            {availableBadges.length === 0 && assignedBadges.length === 0 && (
              <p className="text-sm text-gray-500">
                No hay badges configurados en la academia. Crea badges en la configuración para asignarlos a los estudiantes.
              </p>
            )}
          </>
        )}
      </div>
      {snackbar.show && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm shadow-lg"
        >
          {snackbar.message}
        </div>
      )}
    </div>
  );
}
