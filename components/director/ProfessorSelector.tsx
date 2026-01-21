"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfessorSelectorProps {
  academyId: string;
}

export function ProfessorSelector({ academyId }: ProfessorSelectorProps) {
  const [professors, setProfessors] = useState<Profile[]>([]);
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadProfessors() {
      try {
        const response = await fetch("/api/professors");
        if (!response.ok) {
          throw new Error("Failed to load professors");
        }
        const data = await response.json();
        const activeProfessors = (data.professors || []).filter(
          (p: Profile) => p.status === "active" && !p.deleted_at
        );
        setProfessors(activeProfessors);

        // Check current URL path for professorId
        const pathParts = window.location.pathname.split("/");
        const professorIdFromPath = pathParts[pathParts.length - 1];
        
        // Check if there's a professor ID in the URL or stored selection
        const stored = localStorage.getItem("selectedProfessorId");
        const professorId = professorIdFromPath && professorIdFromPath !== "aula" 
          ? professorIdFromPath 
          : stored;
        
        if (professorId && activeProfessors.some((p: Profile) => p.id === professorId)) {
          setSelectedProfessorId(professorId);
          if (professorId !== stored) {
            localStorage.setItem("selectedProfessorId", professorId);
          }
        }
      } catch (error) {
        console.error("Error loading professors:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfessors();
  }, [academyId]);

  const handleSelect = (professorId: string) => {
    setSelectedProfessorId(professorId);
    localStorage.setItem("selectedProfessorId", professorId);
    router.push(`/director/aula/${professorId}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Cargando profesores...</p>
      </div>
    );
  }

  if (professors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">No hay profesores activos disponibles.</p>
      </div>
    );
  }

  const selectedProfessor = professors.find((p) => p.id === selectedProfessorId);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Seleccionar Profesor
      </h2>
      <div className="space-y-3">
        <select
          value={selectedProfessorId}
          onChange={(e) => handleSelect(e.target.value)}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
        >
          <option value="">Selecciona un profesor...</option>
          {professors.map((professor) => {
            const fullName = `${professor.first_name || ""} ${professor.last_name || ""}`.trim() || professor.email;
            return (
              <option key={professor.id} value={professor.id}>
                {fullName}
              </option>
            );
          })}
        </select>
        {selectedProfessor && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-md">
            <p className="text-sm text-gray-600">
              Profesor seleccionado:{" "}
              <span className="font-medium text-indigo-700">
                {`${selectedProfessor.first_name || ""} ${selectedProfessor.last_name || ""}`.trim() ||
                  selectedProfessor.email}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
