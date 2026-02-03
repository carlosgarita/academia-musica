"use client";

import { User } from "lucide-react";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  enrollment_status?: string | null;
  date_of_birth?: string | null;
  relationship?: string | null;
};

export function HogarStudentList({
  students,
  selectedStudentId,
  onSelectStudent,
  loading,
}: {
  students: Student[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 h-12 w-32 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <p className="text-gray-600 text-sm">
        No hay estudiantes asignados a este encargado.
      </p>
    );
  }

  const studentName = (s: Student) =>
    [s.first_name, s.last_name].filter(Boolean).join(" ").trim() ||
    "Sin nombre";

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {students.map((student) => {
        const isSelected = selectedStudentId === student.id;
        return (
          <button
            key={student.id}
            onClick={() => onSelectStudent(student.id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
              isSelected
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-900 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                isSelected ? "bg-indigo-100" : "bg-gray-100"
              }`}
            >
              <User
                className={`h-4 w-4 ${
                  isSelected ? "text-white" : "text-gray-600"
                }`}
              />
            </div>
            <div className="text-left">
              <p className="font-medium text-sm leading-tight">
                {studentName(student)}
              </p>
              {student.relationship && (
                <p
                  className={`text-xs ${
                    isSelected ? "text-white/80" : "text-gray-600"
                  }`}
                >
                  {student.relationship}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
