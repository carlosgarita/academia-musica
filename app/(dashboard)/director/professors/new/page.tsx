import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NewProfessorForm } from "./new-professor-form";

export default async function NewProfessorPage() {
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
  const p: Profile | null = profile as Profile | null;

  if (!p?.academy_id) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Agregar Nuevo Profesor
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea un nuevo profesor para tu academia
        </p>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        <NewProfessorForm academyId={p!.academy_id} />
      </div>
    </div>
  );
}
