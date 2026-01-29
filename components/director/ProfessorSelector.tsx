"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();

  // Función para extraer professorId de la URL
  const getProfessorIdFromPath = (path: string | null | undefined): string | null => {
    if (!path || typeof path !== "string") return null;
    const pathParts = path.split("/").filter(Boolean);
    const aulaIndex = pathParts.indexOf("aula");
    if (
      aulaIndex >= 0 &&
      pathParts[aulaIndex + 1] &&
      pathParts[aulaIndex + 1] !== "curso"
    ) {
      return pathParts[aulaIndex + 1];
    }
    return null;
  };

  // Cargar profesores (la API ya filtra por deleted_at y academia)
  useEffect(() => {
    async function loadProfessors() {
      try {
        const response = await fetch("/api/professors");
        if (!response.ok) {
          throw new Error("Failed to load professors");
        }
        const data = await response.json();
        const list = (data.professors || []).filter((p: Profile) => !p.deleted_at);
        setProfessors(list);
      } catch (error) {
        console.error("Error loading professors:", error);
        setProfessors([]);
      } finally {
        setLoading(false);
      }
    }

    loadProfessors();
  }, [academyId]);

  // Sincronizar selección solo con la URL: sin profesor en ruta = siempre "Selecciona un profesor..."
  useEffect(() => {
    if (loading || professors.length === 0) return;

    const professorIdFromPath = getProfessorIdFromPath(pathname);

    setSelectedProfessorId((currentId) => {
      // Si hay profesor en la URL y es válido, mostrarlo seleccionado
      if (professorIdFromPath && professors.some((p: Profile) => p.id === professorIdFromPath)) {
        return currentId !== professorIdFromPath ? professorIdFromPath : currentId;
      }
      // Si estamos en /director/aula o en otra sección: siempre vacío (no usar localStorage)
      return currentId !== "" ? "" : currentId;
    });
  }, [pathname, loading, professors]);

  const handleSelect = (professorId: string) => {
    const newProfessorId = professorId.trim();

    if (!newProfessorId || newProfessorId === "") {
      // Si se selecciona "Selecciona un profesor...", ir a /director/aula
      setSelectedProfessorId("");
      if (pathname !== "/director/aula") {
        router.push("/director/aula");
      }
      return;
    }

    // Validar que el profesor existe en la lista
    if (!professors.some((p) => p.id === newProfessorId)) {
      console.error("Selected professor not found in list:", newProfessorId);
      return;
    }

    // Si ya estamos en la página de ese profesor, no hacer nada
    if (pathname.includes(`/director/aula/${newProfessorId}`)) {
      return;
    }

    setSelectedProfessorId(newProfessorId);
    router.push(`/director/aula/${newProfessorId}`);
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
      </div>
    </div>
  );
}
