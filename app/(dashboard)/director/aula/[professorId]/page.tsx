import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProfessorSelector } from "@/components/director/ProfessorSelector";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AulaProfessorPage({
  params,
}: {
  params: { professorId: string };
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
    .select("role, academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "director" || !profile.academy_id) {
    redirect("/");
  }

  // Fetch professor data
  const { data: professor } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", params.professorId)
    .eq("role", "professor")
    .is("deleted_at", null)
    .single();

  if (!professor) {
    redirect("/director/aula");
  }

  const professorName =
    professor && (professor.first_name || professor.last_name)
      ? `${professor.first_name || ""} ${professor.last_name || ""}`.trim()
      : professor?.email || "Profesor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aula</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visualiza y gestiona las funciones del profesor
        </p>
      </div>
      <ProfessorSelector academyId={profile.academy_id} />
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Vista Aula - {professorName}
        </h2>
        <p className="text-gray-500">
          Las funciones del profesor estarán disponibles próximamente.
        </p>
      </div>
    </div>
  );
}
