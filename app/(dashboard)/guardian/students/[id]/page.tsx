import { redirect, notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Database } from "@/lib/database.types";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface EnrollmentWithDetails extends Enrollment {
  subject: Subject;
  teacher: Profile; // teacher_id references profiles (where role='professor')
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

  // Get enrollments with subject and professor details
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select(`
      *,
      subject:subjects(*),
      professor:professors(*, profile:profiles(*))
    `)
    .eq("student_id", params.id)
    .eq("status", "active")
    .order("enrollment_date", { ascending: false });

  const enrollmentsWithDetails: EnrollmentWithDetails[] =
    enrollments?.map((e: any) => ({
      ...e,
      subject: e.subject,
      professor: {
        ...e.professor,
        profile: e.professor.profile,
      },
    })) || [];

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

        {/* Enrollments */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Materias Inscritas
            </h3>
            {enrollmentsWithDetails.length > 0 ? (
              <div className="space-y-4">
                {enrollmentsWithDetails.map((enrollment) => (
                  <div
                    key={enrollment.id}
                    className="border-l-4 border-indigo-500 pl-4 py-2"
                  >
                    <h4 className="text-sm font-semibold text-gray-900">
                      {enrollment.subject?.name || "Materia no disponible"}
                    </h4>
                    {enrollment.subject?.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {enrollment.subject.description}
                      </p>
                    )}
                    {enrollment.teacher && (
                      <p className="text-xs text-gray-600 mt-2">
                        Profesor:{" "}
                        {`${enrollment.teacher.first_name || ""} ${enrollment.teacher.last_name || ""}`.trim() ||
                          enrollment.teacher.email || "N/A"}
                      </p>
                    )}
                    {enrollment.enrollment_date && (
                      <p className="text-xs text-gray-500 mt-1">
                        Inscrito desde:{" "}
                        {new Date(enrollment.enrollment_date).toLocaleDateString(
                          "es-ES"
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No hay materias inscritas actualmente
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
