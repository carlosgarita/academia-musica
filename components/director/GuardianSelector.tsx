"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface GuardianSelectorProps {
  academyId: string;
}

export function GuardianSelector({ academyId }: GuardianSelectorProps) {
  const [guardians, setGuardians] = useState<Profile[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadGuardians() {
      try {
        const response = await fetch("/api/guardians");
        if (!response.ok) {
          throw new Error("Failed to load guardians");
        }
        const data = await response.json();
        const activeGuardians = (data.guardians || []).filter(
          (g: Profile) => g.status === "active" && !g.deleted_at
        );
        setGuardians(activeGuardians);

        // Check current URL path for guardianId
        const pathParts = window.location.pathname.split("/");
        const guardianIdFromPath = pathParts[pathParts.length - 1];
        
        // Check if there's a guardian ID in the URL or stored selection
        const stored = localStorage.getItem("selectedGuardianId");
        const guardianId = guardianIdFromPath && guardianIdFromPath !== "hogar"
          ? guardianIdFromPath
          : stored;
        
        if (guardianId && activeGuardians.some((g: Profile) => g.id === guardianId)) {
          setSelectedGuardianId(guardianId);
          if (guardianId !== stored) {
            localStorage.setItem("selectedGuardianId", guardianId);
          }
        }
      } catch (error) {
        console.error("Error loading guardians:", error);
      } finally {
        setLoading(false);
      }
    }

    loadGuardians();
  }, [academyId]);

  const handleSelect = (guardianId: string) => {
    setSelectedGuardianId(guardianId);
    localStorage.setItem("selectedGuardianId", guardianId);
    router.push(`/director/hogar/${guardianId}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Cargando encargados...</p>
      </div>
    );
  }

  if (guardians.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">No hay encargados activos disponibles.</p>
      </div>
    );
  }

  const selectedGuardian = guardians.find((g) => g.id === selectedGuardianId);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Seleccionar Encargado
      </h2>
      <div className="space-y-3">
        <select
          value={selectedGuardianId}
          onChange={(e) => handleSelect(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
        >
          <option value="">Selecciona un encargado...</option>
          {guardians.map((guardian) => {
            const fullName = `${guardian.first_name || ""} ${guardian.last_name || ""}`.trim() || guardian.email;
            return (
              <option key={guardian.id} value={guardian.id}>
                {fullName}
              </option>
            );
          })}
        </select>
        {selectedGuardian && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-md">
            <p className="text-sm text-gray-600">
              Encargado seleccionado:{" "}
              <span className="font-medium text-indigo-700">
                {`${selectedGuardian.first_name || ""} ${selectedGuardian.last_name || ""}`.trim() ||
                  selectedGuardian.email}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
