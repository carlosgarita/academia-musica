import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { DashboardStats } from "./DashboardStats";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Student = Database["public"]["Tables"]["students"]["Row"];

export default async function StudentDashboardPage() {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // Get the student's profile
  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "student") {
    redirect("/");
  }

  // Get the student's record
  const { data: student } = (await supabase
    .from("students")
    .select("*")
    .eq("user_id", user.id)
    .single()) as { data: Student | null };

  if (!student) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
      <DashboardStats studentId={student.id} />

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Próximas Clases</h2>
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center text-gray-500">
              <p>El horario de clases estará disponible próximamente.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Tareas Pendientes</h2>
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center text-gray-500">
              <p>Las tareas estarán disponibles próximamente.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
