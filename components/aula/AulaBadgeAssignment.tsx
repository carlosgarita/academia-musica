"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Award, Plus, X } from "lucide-react";

type AssignedBadge = {
  id: string;
  badge_id: string;
  name: string;
  virtud?: string | null;
  description?: string | null;
  frase?: string | null;
  image_url?: string | null;
  assigned_at: string;
};

type AvailableBadge = {
  id: string;
  name: string;
  virtud?: string | null;
  description?: string | null;
  frase?: string | null;
  image_url?: string | null;
};

export function AulaBadgeAssignment({
  registrationId,
  academyId,
  onSnackbar,
}: {
  registrationId: string;
  academyId: string;
  onSnackbar: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assignedBadges, setAssignedBadges] = useState<AssignedBadge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<AvailableBadge[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningBadgeId, setAssigningBadgeId] = useState<string | null>(null);
  const [removingBadgeId, setRemovingBadgeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!expanded) return;
    setLoading(true);
    try {
      const [assignedRes, availableRes] = await Promise.all([
        fetch(
          `/api/student-badges?course_registration_id=${encodeURIComponent(
            registrationId
          )}`
        ),
        fetch(`/api/badges?academy_id=${encodeURIComponent(academyId)}`),
      ]);
      const assignedData = await assignedRes.json();
      const availableData = await availableRes.json();
      if (assignedRes.ok && assignedData.badges)
        setAssignedBadges(assignedData.badges);
      if (availableRes.ok && availableData.badges)
        setAvailableBadges(availableData.badges);
    } catch (e) {
      console.error("Error loading badges:", e);
    } finally {
      setLoading(false);
    }
  }, [expanded, registrationId, academyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssign = async (badgeId: string) => {
    setAssigningBadgeId(badgeId);
    try {
      const r = await fetch("/api/student-badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_registration_id: registrationId,
          badge_id: badgeId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Error al asignar");
      const badge = availableBadges.find((b) => b.id === badgeId);
      if (badge) {
        setAssignedBadges((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            badge_id: badgeId,
            name: badge.name,
            virtud: badge.virtud,
            description: badge.description,
            frase: badge.frase,
            image_url: badge.image_url,
            assigned_at: new Date().toISOString(),
          },
        ]);
        onSnackbar("Badge asignado");
      }
    } catch (e) {
      console.error("Error assigning badge:", e);
      onSnackbar(e instanceof Error ? e.message : "Error al asignar badge");
    } finally {
      setAssigningBadgeId(null);
    }
  };

  const handleRemove = async (badgeId: string) => {
    setRemovingBadgeId(badgeId);
    try {
      const r = await fetch(
        `/api/student-badges?course_registration_id=${encodeURIComponent(
          registrationId
        )}&badge_id=${encodeURIComponent(badgeId)}`,
        { method: "DELETE" }
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "Error al quitar");
      }
      setAssignedBadges((prev) => prev.filter((b) => b.badge_id !== badgeId));
      onSnackbar("Badge quitado");
    } catch (e) {
      console.error("Error removing badge:", e);
      onSnackbar(e instanceof Error ? e.message : "Error al quitar badge");
    } finally {
      setRemovingBadgeId(null);
    }
  };

  const notAssigned = availableBadges.filter(
    (b) => !assignedBadges.some((ab) => ab.badge_id === b.id)
  );

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        <ChevronDown className="h-4 w-4" />
        Asignar badges
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
        Ocultar badges
      </button>
      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {assignedBadges.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Asignados
              </h4>
              <div className="flex flex-wrap gap-2">
                {assignedBadges.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2"
                  >
                    {b.image_url?.startsWith("http") ? (
                      <img
                        src={b.image_url}
                        alt={b.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-gray-200 flex items-center justify-center">
                        <Award className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {b.name}
                      </p>
                      {b.virtud && (
                        <p className="text-xs text-indigo-600">{b.virtud}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(b.badge_id)}
                      disabled={removingBadgeId !== null}
                      className="ml-1 text-gray-500 hover:text-gray-600 disabled:opacity-50 p-0.5"
                      title="Quitar badge"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {notAssigned.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {assignedBadges.length > 0 ? "Asignar más" : "Disponibles"}
              </h4>
              <div className="flex flex-wrap gap-2">
                {notAssigned.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleAssign(b.id)}
                    disabled={assigningBadgeId !== null}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {b.image_url?.startsWith("http") ? (
                      <img
                        src={b.image_url}
                        alt={b.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                        <Award className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">
                        {b.name}
                      </p>
                      {b.virtud && (
                        <p className="text-xs text-indigo-600">{b.virtud}</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-indigo-600 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {availableBadges.length === 0 && assignedBadges.length === 0 && (
            <p className="text-sm text-gray-500">
              No hay badges configurados en la academia. Crea badges en la
              configuración.
            </p>
          )}
          {assignedBadges.length > 0 && notAssigned.length === 0 && (
            <p className="text-sm text-gray-500">
              Todos los badges disponibles ya están asignados.
            </p>
          )}
        </>
      )}
    </div>
  );
}
