import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ProfessorSelector } from "@/components/director/ProfessorSelector";
import { StudentsList } from "@/app/(dashboard)/director/direccion/students/students-list";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AulaEstudiantesPage({
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
    .select("role, academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (
    !profile ||
    (profile.role !== "director" && profile.role !== "super_admin") ||
    (profile.role === "director" && !profile.academy_id)
  ) {
    redirect("/");
  }

  if (!professorId || professorId.trim() === "" || professorId.length < 10) {
    redirect("/director/aula");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/director/aula");
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: professor, error: professorError } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, email, academy_id")
    .eq("id", professorId)
    .eq("role", "professor")
    .is("deleted_at", null)
    .maybeSingle();

  if (professorError || !professor) {
    redirect("/director/aula");
  }

  if (
    profile.role !== "super_admin" &&
    professor.academy_id !== profile.academy_id
  ) {
    redirect("/director/aula");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/director/aula/${professorId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          ← Volver a Aula
        </Link>
      </div>
      <ProfessorSelector academyId={profile.academy_id ?? ""} />
      <div className="container mx-auto">
        <StudentsList
          academyId={profile.academy_id!}
          professorId={professorId}
          readOnly
        />
      </div>
    </div>
  );
}
