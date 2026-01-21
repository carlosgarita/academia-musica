import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { EditProfessorForm } from "./edit-professor-form";

export default async function EditProfessorPage({
  params,
}: {
  params: { id: string };
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("academy_id")
    .eq("id", user.id)
    .single();

  type Profile = { academy_id: string | null };
  const p = profile as Profile | null;

  if (!p?.academy_id) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Editar Profesor</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modifica la información del profesor
        </p>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        <EditProfessorForm professorId={params.id} />
      </div>
    </div>
  );
}
