import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];

export default async function StudentInfoPage() {
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

  if (!profile || profile.role !== "student") {
    redirect("/");
  }

  // Check if student is their own guardian (adult student)
  // Check via guardian_students table
  const { data: student } = (await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .single()) as { data: Student | null };

  let isOwnGuardian = false;
  if (student) {
    const { data: guardianAssignment } = await supabase
      .from("guardian_students")
      .select("guardian_id")
      .eq("student_id", student.id)
      .single();
    
    isOwnGuardian = guardianAssignment?.guardian_id === user.id;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4">
                <svg
                  className="h-6 w-6 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Portal de Estudiantes
              </h2>
              <p className="text-lg text-gray-600 mb-6">
                Los estudiantes no tienen un portal propio. Toda tu información
                académica, horarios, tareas y progreso se gestiona a través
                del portal de tu encargado.
              </p>

              {isOwnGuardian ? (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Nota:</strong> Como estudiante mayor de edad, eres
                    tu propio encargado. Debes tener una cuenta adicional con
                    rol de encargado para acceder al portal de gestión.
                  </p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
                  <p className="text-sm text-gray-700">
                    Para ver tu información, tu encargado debe iniciar sesión
                    en el portal de encargados y podrá ver todos tus datos
                    académicos.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-md font-semibold text-gray-900 mb-2">
                    ¿Qué puedes hacer?
                  </h3>
                  <ul className="text-left text-sm text-gray-600 space-y-2 list-disc list-inside">
                    <li>
                      Contactar a tu encargado para que acceda al portal y vea
                      tu información
                    </li>
                    <li>
                      Si eres mayor de edad, solicitar una cuenta de encargado
                      para gestionar tu propia información
                    </li>
                    <li>
                      Comunicarte directamente con tu academia para cualquier
                      consulta
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Link
                    href="/login"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Volver al inicio de sesión
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
