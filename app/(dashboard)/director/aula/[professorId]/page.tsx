import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ProfessorSelector } from "@/components/director/ProfessorSelector";
import { AulaCourseList } from "./AulaCourseList";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AulaProfessorPage({
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

  if (!profile || profile.role !== "director" || !profile.academy_id) {
    redirect("/");
  }

  // Validar que professorId no esté vacío y tenga formato válido (UUID básico)
  if (!professorId || professorId.trim() === "" || professorId.length < 10) {
    console.log("[AulaProfessorPage] Invalid professorId:", professorId);
    redirect("/director/aula");
  }

  console.log("[AulaProfessorPage] Loading professor:", professorId, "User academy:", profile.academy_id);

  // Usar service role para evitar problemas de RLS (similar a la API de profesores)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[AulaProfessorPage] SUPABASE_SERVICE_ROLE_KEY not set");
    redirect("/director/aula");
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // Primero verificar si el profesor existe (sin filtros estrictos)
  const { data: professorCheck } = await supabaseAdmin
    .from("profiles")
    .select("id, role, deleted_at, academy_id, status")
    .eq("id", professorId)
    .maybeSingle();

  console.log("[AulaProfessorPage] Professor check:", {
    exists: !!professorCheck,
    role: professorCheck?.role,
    deleted_at: professorCheck?.deleted_at,
    academy_id: professorCheck?.academy_id,
    status: professorCheck?.status,
  });

  // Obtener profesor con academy_id en una sola consulta
  // Usar maybeSingle() en lugar de single() para evitar error cuando no existe
  const { data: professor, error: professorError } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, email, academy_id")
    .eq("id", professorId)
    .eq("role", "professor")
    .is("deleted_at", null)
    .maybeSingle();

  if (professorError) {
    // Log del error de forma más segura
    const errorMessage = 
      professorError.message || 
      (typeof professorError === 'object' ? JSON.stringify(professorError) : String(professorError)) || 
      "Unknown error";
    console.error("[AulaProfessorPage] Error loading professor:", errorMessage, "ProfessorId:", professorId);
    redirect("/director/aula");
  }

  if (!professor) {
    // No es un error crítico, simplemente el profesor no existe o no cumple condiciones
    console.log("[AulaProfessorPage] Professor not found or doesn't meet conditions:", professorId);
    redirect("/director/aula");
  }

  console.log("[AulaProfessorPage] Professor found:", {
    id: professor.id || "N/A",
    name: `${professor.first_name || ""} ${professor.last_name || ""}`.trim() || professor.email,
    academy_id: professor.academy_id,
  });

  // Verificar que el profesor pertenece a la misma academia
  if (
    profile.role !== "super_admin" &&
    professor.academy_id !== profile.academy_id
  ) {
    console.error("[AulaProfessorPage] Professor belongs to different academy:", {
      professorAcademy: professor.academy_id,
      userAcademy: profile.academy_id,
    });
    redirect("/director/aula");
  }

  console.log("[AulaProfessorPage] All checks passed, rendering page");

  const professorName =
    professor && (professor.first_name || professor.last_name)
      ? `${professor.first_name || ""} ${professor.last_name || ""}`.trim()
      : professor?.email || "Profesor";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Aula</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cursos y sesiones del profesor — selecciona un curso para ver sesiones
          y expedientes
        </p>
      </div>
      <ProfessorSelector academyId={profile.academy_id} />
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Cursos de {professorName}
        </h2>
        <AulaCourseList professorId={professorId} />
      </div>
    </div>
  );
}
