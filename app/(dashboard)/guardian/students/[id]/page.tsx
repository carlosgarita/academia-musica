import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Database } from "@/lib/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];
type CourseRegistration = Database["public"]["Tables"]["course_registrations"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type Period = Database["public"]["Tables"]["periods"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface CourseRegistrationWithDetails extends CourseRegistration {
  subject: Subject | null;
  period: Period | null;
  professor: Profile | null; // profile_id from professor_subject_periods
}

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "guardian") {
    redirect("/");
  }

  // Verify student belongs to this guardian via guardian_students table
  const { data: guardianAssignment } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", user.id)
    .eq("student_id", params.id)
    .single();

  if (!guardianAssignment) {
    notFound();
  }

  // Get student
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(`
      *,
      academy:academies(name, address, phone)
    `)
    .eq("id", params.id)
    .single();

  if (studentError || !student) {
    notFound();
  }

  // Get course_registrations with subject, period, and professor details
  const { data: registrations } = await supabase
    .from("course_registrations")
    .select(`
      *,
      subject:subjects(*),
      period:periods(*)
    `)
    .eq("student_id", params.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("enrollment_date", { ascending: false });

  // Get professors for all registrations via profiles (using profile_id from course_registrations)
  const registrationsWithProfessor: CourseRegistrationWithDetails[] = [];
  if (registrations && registrations.length > 0) {
    const profileIds = registrations
      .map((r) => r.profile_id)
      .filter((id): id is string => id !== null);
    
    let professorsMap: Record<string, Profile> = {};
    if (profileIds.length > 0) {
      const { data: professors } = await supabase
        .from("profiles")
        .select("*")
        .in("id", profileIds)
        .eq("role", "professor");
      
      if (professors) {
        professorsMap = professors.reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, Profile>);
      }
    }

    registrationsWithProfessor.push(...registrations.map((reg) => ({
      ...reg,
      subject: reg.subject as Subject | null,
      period: reg.period as Period | null,
      professor: reg.profile_id ? (professorsMap[reg.profile_id] || null) : null,
    })));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/guardian"
            className="text-sm text-indigo-600 hover:text-indigo-500 mb-2 inline-block"
          >
            ← Volver a mis estudiantes
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Información detallada del estudiante
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            student.enrollment_status === "inscrito"
              ? "bg-green-100 text-green-800"
              : student.enrollment_status === "retirado"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {student.enrollment_status || "inscrito"}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Student Information */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Información del Estudiante
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Nombre</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre"}
                </dd>
              </div>
              {student.date_of_birth && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Fecha de Nacimiento
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(student.date_of_birth).toLocaleDateString(
                      "es-ES",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </dd>
                </div>
              )}
              {student.academy && (
                <>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Academia
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {student.academy.name}
                    </dd>
                  </div>
                  {student.academy.address && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Dirección
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {student.academy.address}
                      </dd>
                    </div>
                  )}
                  {student.academy.phone && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Teléfono
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {student.academy.phone}
                      </dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Course Registrations */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Cursos Inscritos
            </h3>
            {registrationsWithProfessor.length > 0 ? (
              <div className="space-y-4">
                {registrationsWithProfessor.map((registration) => (
                  <div
                    key={registration.id}
                    className="border-l-4 border-indigo-500 pl-4 py-2"
                  >
                    <h4 className="text-sm font-semibold text-gray-900">
                      {registration.subject?.name || "Curso no disponible"}
                    </h4>
                    {registration.period && (
                      <p className="text-xs text-gray-600 mt-1">
                        Periodo: {registration.period.year} – {registration.period.period}
                      </p>
                    )}
                    {registration.professor && (
                      <p className="text-xs text-gray-600 mt-1">
                        Profesor:{" "}
                        {`${registration.professor.first_name || ""} ${registration.professor.last_name || ""}`.trim() ||
                          registration.professor.email || "N/A"}
                      </p>
                    )}
                    {registration.enrollment_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        Inscrito desde:{" "}
                        {new Date(registration.enrollment_date).toLocaleDateString(
                          "es-ES"
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No hay cursos inscritos actualmente
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Payments Section - Placeholder for future implementation */}
      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Estado de Pagos
          </h3>
          <p className="text-sm text-gray-500">
            La gestión de pagos estará disponible próximamente.
          </p>
        </div>
      </div>
    </div>
  );
}
