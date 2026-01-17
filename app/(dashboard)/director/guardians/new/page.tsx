import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NewGuardianForm } from "./new-guardian-form";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function NewGuardianPage() {
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
    .select("academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile?.academy_id) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Encargado</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea un nuevo encargado para tu academia
        </p>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        <NewGuardianForm academyId={profile.academy_id} />
      </div>
    </div>
  );
}
