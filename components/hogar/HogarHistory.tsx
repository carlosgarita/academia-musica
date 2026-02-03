"use client";

import { useEffect, useState } from "react";
import { BookOpen, Award, Calendar } from "lucide-react";

type Course = {
  id: string;
  subject: { id: string; name: string } | null;
  period: { id: string; year: number; period: string } | null;
  status: string | null;
};

type Badge = {
  id: string;
  badgeId: string;
  name: string;
  virtud?: string | null;
  description?: string | null;
  frase?: string | null;
  imageUrl?: string | null;
  dateFormatted: string;
  courseName?: string;
};

export function HogarHistory({
  studentId,
  guardianId,
  historicalCourses,
}: {
  studentId: string;
  guardianId?: string;
  historicalCourses: Course[];
}) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);

  useEffect(() => {
    async function loadAllBadges() {
      if (historicalCourses.length === 0) {
        setBadges([]);
        return;
      }

      setLoadingBadges(true);
      const allBadges: Badge[] = [];

      // Fetch badges from each historical course
      for (const course of historicalCourses) {
        try {
          const url = guardianId
            ? `/api/guardian/students/${studentId}/courses/${course.id}/progress?guardian_id=${guardianId}`
            : `/api/guardian/students/${studentId}/courses/${course.id}/progress`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.badges) {
              allBadges.push(
                ...data.badges.map((b: Badge) => ({
                  ...b,
                  courseName: course.subject?.name || "—",
                }))
              );
            }
          }
        } catch (e) {
          console.error("Error loading badges for course:", course.id, e);
        }
      }

      setBadges(allBadges);
      setLoadingBadges(false);
    }

    loadAllBadges();
  }, [studentId, guardianId, historicalCourses]);

  if (historicalCourses.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No hay historial académico anterior.</p>
      </div>
    );
  }

  // Group courses by year
  const coursesByYear = historicalCourses.reduce((acc, course) => {
    const year = course.period?.year || 0;
    if (!acc[year]) acc[year] = [];
    acc[year].push(course);
    return acc;
  }, {} as Record<number, Course[]>);

  const years = Object.keys(coursesByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {/* Historical Courses */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-gray-600" />
          Cursos anteriores
        </h4>
        <div className="space-y-4">
          {years.map((year) => (
            <div key={year}>
              <p className="text-xs font-medium text-gray-600 uppercase mb-2">
                {year}
              </p>
              <ul className="space-y-2">
                {coursesByYear[year].map((course) => (
                  <li
                    key={course.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                  >
                    <p className="font-medium text-gray-900">
                      {course.subject?.name || "Curso sin nombre"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {course.period?.period || "—"} {course.period?.year || ""}
                      {course.status && (
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded-sm text-xs ${
                            course.status === "activo"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {course.status}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* All Historical Badges */}
      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-gray-600" />
          Todas las insignias ganadas
        </h4>
        {loadingBadges ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-gray-100 rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : badges.length === 0 ? (
          <p className="text-gray-600 text-sm">No hay insignias ganadas.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {badges.map((badge, idx) => (
              <div
                key={`${badge.id}-${idx}`}
                className="flex flex-col items-center text-center rounded-lg border border-gray-200 bg-white p-3"
              >
                {badge.imageUrl ? (
                  <img
                    src={badge.imageUrl}
                    alt={badge.name}
                    className="h-12 w-12 object-contain mb-2"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                    <Award className="h-6 w-6 text-indigo-600" />
                  </div>
                )}
                <p className="font-medium text-sm text-gray-900">
                  {badge.name}
                </p>
                {badge.virtud && (
                  <p className="text-xs text-indigo-600">{badge.virtud}</p>
                )}
                <p className="text-xs text-gray-600 mt-1">{badge.courseName}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
