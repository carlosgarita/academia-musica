import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];
type CourseRegistration = Database["public"]["Tables"]["course_registrations"]["Row"];
type Subject = Database["public"]["Tables"]["subjects"]["Row"];

interface StudentWithDetails extends Student {
  courses: (CourseRegistration & { subject: Subject | null })[];
  academy: { name: string } | null;
}

export default async function GuardianDashboardPage() {
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
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "guardian") {
    redirect("/");
  }

  // Get all students assigned to this guardian via guardian_students table
  const { data: guardianAssignments } = await supabase
    .from("guardian_students")
    .select("student_id")
    .eq("guardian_id", user.id);

  const studentIds = guardianAssignments?.map((a) => a.student_id) || [];

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select(`
      *,
      academy:academies(name)
    `)
    .in("id", studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"])
    .order("first_name", { ascending: true })
    .order("last_name", { ascending: true });

  if (studentsError) {
    console.error("Error fetching students:", studentsError);
  }

  // Get course_registrations for all students (active only)
  const studentIdsForCourses = students?.map((s) => s.id) || [];
  let courseRegistrations: (CourseRegistration & { subject: Subject | null })[] = [];

  if (studentIdsForCourses.length > 0) {
    const { data: registrationsData } = await supabase
      .from("course_registrations")
      .select(`
        *,
        subject:subjects(*)
      `)
      .in("student_id", studentIdsForCourses)
      .eq("status", "active")
      .is("deleted_at", null);

    courseRegistrations = (registrationsData || []).map((r: any) => ({
      ...r,
      subject: r.subject || null,
    }));
  }

  // Combine data
  const studentsWithDetails: StudentWithDetails[] =
    students?.map((student) => {
      const studentCourses = courseRegistrations.filter(
        (cr) => cr.student_id === student.id
      );

      return {
        ...student,
        courses: studentCourses,
        academy: student.academy as { name: string } | null,
      };
    }) || [];

  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Encargado";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {fullName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Aquí puedes ver y gestionar la información de tus estudiantes
        </p>
      </div>

      {studentsWithDetails.length === 0 ? (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center">
              <p className="text-gray-500">
                No tienes estudiantes asignados actualmente.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {studentsWithDetails.map((student) => (
            <div
              key={student.id}
              className="bg-white shadow sm:rounded-lg overflow-hidden"
            >
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {`${student.first_name || ""} ${student.last_name || ""}`.trim() || "Sin nombre"}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
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

                {student.academy && (
                  <p className="text-sm text-gray-500 mb-4">
                    Academia: {student.academy.name}
                  </p>
                )}

                {student.date_of_birth && (
                  <p className="text-sm text-gray-500 mb-4">
                    Fecha de nacimiento:{" "}
                    {new Date(student.date_of_birth).toLocaleDateString("es-ES")}
                  </p>
                )}

                {student.courses.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Cursos inscritos:
                    </h4>
                    <ul className="space-y-1">
                      {student.courses.map((course) => (
                        <li
                          key={course.id}
                          className="text-sm text-gray-600 flex items-center"
                        >
                          <span className="mr-2">•</span>
                          {course.subject?.name || "Curso no disponible"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mt-4">
                    Sin cursos inscritos
                  </p>
                )}

                <div className="mt-6 flex justify-end">
                  <Link
                    href={`/guardian/students/${student.id}`}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Ver detalles →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {studentsWithDetails.length > 0 && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Resumen
            </h3>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="px-4 py-5 bg-gray-50 rounded-lg">
                <dt className="text-sm font-medium text-gray-500">
                  Total de Estudiantes
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {studentsWithDetails.length}
                </dd>
              </div>
              <div className="px-4 py-5 bg-gray-50 rounded-lg">
                <dt className="text-sm font-medium text-gray-500">
                  Estudiantes Activos
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">
                  {
                    studentsWithDetails.filter(
                      (s) => s.enrollment_status === "inscrito"
                    ).length
                  }
                </dd>
              </div>
              <div className="px-4 py-5 bg-gray-50 rounded-lg">
                <dt className="text-sm font-medium text-gray-500">
                  Total de Cursos
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-indigo-600">
                  {studentsWithDetails.reduce(
                    (acc, s) => acc + s.courses.length,
                    0
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
