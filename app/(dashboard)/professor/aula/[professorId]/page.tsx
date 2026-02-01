import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AulaCourseList } from "@/components/aula";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function ProfessorAulaProfessorPage({
  params,
}: {
  params: Promise<{ professorId: string }>;
}) {
  const { professorId } = await params;
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
    .select("id, role, academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "professor") {
    redirect("/");
  }

  if (professorId !== profile.id) {
    redirect("/professor/aula");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/professor/aula");
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: professor } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", professorId)
    .eq("role", "professor")
    .is("deleted_at", null)
    .maybeSingle();

  if (!professor) {
    redirect("/professor/aula");
  }

  const professorName =
    professor.first_name || professor.last_name
      ? `${professor.first_name || ""} ${professor.last_name || ""}`.trim()
      : professor.email || "Profesor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aula</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cursos y sesiones — selecciona un curso para ver sesiones y expedientes
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cursos de {professorName}</h2>
        <AulaCourseList professorId={professorId} pathPrefix="professor" />
      </div>
    </div>
  );
}
