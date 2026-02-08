import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { AulaSessionList } from "@/components/aula";
import type { Database } from "@/lib/database.types";
import { ChevronRight } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function ProfessorAulaCursoPage({
  params,
}: {
  params: Promise<{ professorId: string; courseId: string }>;
}) {
  const { professorId, courseId } = await params;
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
    redirect(`/professor/aula/${professorId}`);
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

  const { data: courseRow, error: courseErr } = await supabaseAdmin
    .from("courses")
    .select("id, profile_id, name, year")
    .eq("id", courseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (courseErr || !courseRow || courseRow.profile_id !== professorId) {
    redirect(`/professor/aula/${professorId}`);
  }

  const professorName =
    professor.first_name || professor.last_name
      ? `${professor.first_name || ""} ${professor.last_name || ""}`.trim()
      : professor.email || "Profesor";

  const courseLabel = courseRow.name ?? "Curso";
  const yearLabel = courseRow.year ? String(courseRow.year) : "";

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/professor/aula" className="hover:text-gray-700">
            Aula
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={`/professor/aula/${professorId}`} className="hover:text-gray-700">
            {professorName}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-gray-900 font-medium">{courseLabel}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">
          {courseLabel}
          {yearLabel ? ` — ${yearLabel}` : ""}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Sesiones de clase. Selecciona una sesión para ver asistencia y expedientes.
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sesiones</h2>
        <AulaSessionList
          professorId={professorId}
          courseId={courseId}
          courseName={courseLabel}
          pathPrefix="professor"
        />
      </div>
    </div>
  );
}
