"use client";

import { useEffect, useState } from "react";
import { User, BookOpen, History } from "lucide-react";
import { HogarCourseProgress } from "./HogarCourseProgress";
import { HogarHistory } from "./HogarHistory";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  enrollment_status?: string | null;
  date_of_birth?: string | null;
  relationship?: string | null;
};

type Course = {
  id: string;
  student_id: string;
  subject_id: string;
  period_id: string;
  academy_id: string;
  status: string | null;
  subject: { id: string; name: string; description?: string | null } | null;
  period: { id: string; year: number; period: string } | null;
  isCurrent: boolean;
};

type Tab = "current" | "history";

export function HogarStudentView({
  student,
  guardianId,
}: {
  student: Student;
  guardianId?: string;
}) {
  const [courses, setCourses] = useState<{
    currentCourses: Course[];
    historicalCourses: Course[];
  }>({ currentCourses: [], historicalCourses: [] });
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("current");

  const studentName =
    [student.first_name, student.last_name].filter(Boolean).join(" ").trim() ||
    "Sin nombre";

  // Reset tab to Curso actual when switching students
  useEffect(() => {
    setActiveTab("current");
  }, [student.id]);

  useEffect(() => {
    async function loadCourses() {
      setLoadingCourses(true);
      try {
        const url = guardianId
          ? `/api/guardian/students/${student.id}/courses?guardian_id=${guardianId}`
          : `/api/guardian/students/${student.id}/courses`;
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok) {
          setCourses({
            currentCourses: data.currentCourses || [],
            historicalCourses: data.historicalCourses || [],
          });
          // Auto-select first current course
          if (data.currentCourses && data.currentCourses.length > 0) {
            setSelectedCourseId(data.currentCourses[0].id);
          }
        }
      } catch (e) {
        console.error("Error loading courses:", e);
      } finally {
        setLoadingCourses(false);
      }
    }
    loadCourses();
  }, [student.id, guardianId]);

  const { currentCourses, historicalCourses } = courses;

  return (
    <div className="space-y-6">
      {/* Student Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
        <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center">
          <User className="h-7 w-7 text-gray-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{studentName}</h3>
          {student.relationship && (
            <p className="text-sm text-gray-500">{student.relationship}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("current")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "current"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Curso actual
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "history"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <History className="h-4 w-4" />
          Historial académico
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "current" && (
        <div className="space-y-4">
          {loadingCourses ? (
            <div className="space-y-3">
              <div className="h-10 bg-gray-100 rounded animate-pulse w-48" />
              <div className="h-32 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : currentCourses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                No hay cursos activos en este período.
              </p>
            </div>
          ) : (
            <>
              {/* Course Selector (if multiple courses) */}
              {currentCourses.length > 1 && (
                <div>
                  <label
                    htmlFor="course-select"
                    className="block text-xs font-medium text-gray-500 uppercase mb-1"
                  >
                    Seleccionar curso
                  </label>
                  <select
                    id="course-select"
                    value={selectedCourseId || ""}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                  >
                    {currentCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.subject?.name || "Curso sin nombre"} -{" "}
                        {course.period?.period || ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Single course info */}
              {currentCourses.length === 1 && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <p className="font-medium text-indigo-900">
                    {currentCourses[0].subject?.name || "Curso sin nombre"}
                  </p>
                  <p className="text-sm text-indigo-700">
                    {currentCourses[0].period?.period || ""}{" "}
                    {currentCourses[0].period?.year || ""}
                  </p>
                </div>
              )}

              {/* Course Progress */}
              {selectedCourseId && (
                <HogarCourseProgress
                  studentId={student.id}
                  registrationId={selectedCourseId}
                  guardianId={guardianId}
                />
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <HogarHistory
          studentId={student.id}
          guardianId={guardianId}
          historicalCourses={historicalCourses}
        />
      )}
    </div>
  );
}
