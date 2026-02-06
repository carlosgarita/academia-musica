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
  profile: { id: string; first_name: string; last_name: string } | null;
  isCurrent: boolean;
};

type Tab = "current" | "history";

export function HogarStudentView({
  student,
  guardianId,
  hideStudentHeader = false,
}: {
  student: Student;
  guardianId?: string;
  hideStudentHeader?: boolean;
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

  const selectedCourse = currentCourses.find((c) => c.id === selectedCourseId);
  const professorName = selectedCourse?.profile
    ? [selectedCourse.profile.first_name, selectedCourse.profile.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() || "Sin nombre"
    : null;

  return (
    <div className="space-y-6">
      {/* Student Header - hidden when student is their own guardian */}
      {!hideStudentHeader && (
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="h-7 w-7 text-gray-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{studentName}</h3>
            {student.relationship && (
              <p className="text-sm text-gray-600">{student.relationship}</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("current")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === "current"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-600 hover:text-gray-900"
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
              : "border-transparent text-gray-600 hover:text-gray-900"
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
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
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
                    className="block text-xs font-medium text-gray-600 uppercase mb-1"
                  >
                    Seleccionar curso
                  </label>
                  <select
                    id="course-select"
                    value={selectedCourseId || ""}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="block w-full max-w-xs rounded border border-gray-200 bg-white text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                  >
                    {currentCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.subject?.name || "Curso sin nombre"} -{" "}
                        {course.period?.year || ""}
                        {course.period?.year && course.period?.period ? ", " : ""}
                        {course.period?.period || ""}
                      </option>
                    ))}
                  </select>
                  {/* Course name and professor (below dropdown when selected) */}
                  {selectedCourse && (
                    <div className="mt-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedCourse.subject?.name || "Curso sin nombre"}
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        Profesor: {professorName ?? "No asignado"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Single course info */}
              {currentCourses.length === 1 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {currentCourses[0].subject?.name || "Curso sin nombre"}
                  </h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Profesor:{" "}
                    {currentCourses[0].profile
                      ? [currentCourses[0].profile.first_name, currentCourses[0].profile.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "Sin nombre"
                      : "No asignado"}
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
