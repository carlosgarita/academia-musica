import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ProfessorSelector } from "@/components/director/ProfessorSelector";
import { ExpedienteContent } from "./ExpedienteContent";
import type { Database } from "@/lib/database.types";
import { ChevronRight } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function AulaEstudiantePage({
  params,
  searchParams,
}: {
  params: Promise<{
    professorId: string;
    courseId: string;
    registrationId: string;
  }>;
  searchParams: Promise<{ sesion?: string }>;
}) {
  const { professorId, courseId, registrationId } = await params;
  const { sesion: sessionId } = await searchParams;
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

  // Usar service role para evitar RLS en course_registrations y tablas relacionadas
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect(`/director/aula/${professorId}/curso/${courseId}`);
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

  const { data: professor } = await supabaseAdmin
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", professorId)
    .eq("role", "professor")
    .is("deleted_at", null)
    .maybeSingle();

  if (!professor) {
    redirect("/director/aula");
  }

  const { data: psp } = await supabaseAdmin
    .from("professor_subject_periods")
    .select("id, profile_id, subject_id, period_id, period:periods(academy_id), subject:subjects(name)")
    .eq("id", courseId)
    .maybeSingle();

  if (!psp || psp.profile_id !== professorId) {
    redirect(`/director/aula/${professorId}`);
  }

  const period = psp.period as { academy_id?: string } | null;
  if (
    profile.role !== "super_admin" &&
    period?.academy_id !== profile.academy_id
  ) {
    redirect("/director/aula");
  }

  const { data: reg } = await supabaseAdmin
    .from("course_registrations")
    .select(
      `
      id,
      student_id,
      subject_id,
      period_id,
      profile_id,
      student:students(id, first_name, last_name, deleted_at),
      subject:subjects(id, name, deleted_at),
      period:periods(id, year, period, deleted_at)
    `
    )
    .eq("id", registrationId)
    .eq("period_id", psp.period_id)
    .eq("subject_id", psp.subject_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!reg) {
    redirect(`/director/aula/${professorId}/curso/${courseId}`);
  }

  const student = reg.student as
    | { id: string; first_name: string; last_name: string; deleted_at?: string | null }
    | null;
  if (!student || student.deleted_at) {
    redirect(`/director/aula/${professorId}/curso/${courseId}`);
  }

  const subject = psp.subject as { name?: string } | null;
  const professorName =
    professor.first_name || professor.last_name
      ? `${professor.first_name || ""} ${professor.last_name || ""}`.trim()
      : professor.email || "Profesor";

  const studentName = [student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Estudiante";

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2 flex-wrap">
          <Link href="/director/aula" className="hover:text-gray-700">
            Aula
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <Link
            href={`/director/aula/${professorId}`}
            className="hover:text-gray-700"
          >
            {professorName}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <Link
            href={`/director/aula/${professorId}/curso/${courseId}`}
            className="hover:text-gray-700"
          >
            {subject?.name ?? "Curso"}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="text-gray-900 font-medium">{studentName}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">
          Expediente — {studentName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Canciones asignadas, calificaciones y comentarios del curso.
        </p>
      </div>
      <ProfessorSelector academyId={profile.academy_id} />
      <ExpedienteContent
        registrationId={registrationId}
        courseId={courseId}
        professorId={professorId}
        sessionId={sessionId}
      />
    </div>
  );
}
