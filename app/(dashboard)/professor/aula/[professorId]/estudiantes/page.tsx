import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { StudentsList } from "@/app/(dashboard)/director/direccion/students/students-list";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function ProfessorAulaEstudiantesPage({
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

  if (!profile || profile.role !== "professor" || !profile.academy_id) {
    redirect("/");
  }

  if (professorId !== profile.id) {
    redirect("/professor/aula");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/professor/aula/${professorId}`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          ← Volver a Aula
        </Link>
      </div>
      <div className="container mx-auto">
        <StudentsList
          academyId={profile.academy_id}
          professorId={professorId}
          readOnly
        />
      </div>
    </div>
  );
}
