import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { GuardianSelector } from "@/components/director/GuardianSelector";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function HogarPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hogar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Visualiza y gestiona las funciones del encargado
        </p>
      </div>
      <GuardianSelector academyId={profile.academy_id} />
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">
          Selecciona un encargado para ver su vista y realizar sus funciones.
        </p>
      </div>
    </div>
  );
}
