"use client";

import { AulaCourseList } from "./AulaCourseList";

interface AulaMainContentProps {
  professorId: string;
  professorName: string;
  pathPrefix: "director" | "professor";
}

export function AulaMainContent({
  professorId,
  professorName,
  pathPrefix,
}: AulaMainContentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aula</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cursos y sesiones — selecciona un curso para ver sesiones y expedientes
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Cursos de {professorName}
        </h2>
        <AulaCourseList professorId={professorId} pathPrefix={pathPrefix} />
      </div>
    </div>
  );
}
