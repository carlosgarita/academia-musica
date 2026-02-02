import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { GuardianSelector } from "@/components/director/GuardianSelector";
import { HogarContent } from "@/components/hogar";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function HogarGuardianPage({
  params,
}: {
  params: { guardianId: string };
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

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "director" || !profile.academy_id) {
    redirect("/");
  }

  // Fetch guardian data
  const { data: guardian } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, academy_id")
    .eq("id", params.guardianId)
    .eq("role", "guardian")
    .is("deleted_at", null)
    .single();

  if (!guardian || guardian.academy_id !== profile.academy_id) {
    redirect("/director/hogar");
  }

  const guardianName =
    guardian && (guardian.first_name || guardian.last_name)
      ? `${guardian.first_name || ""} ${guardian.last_name || ""}`.trim()
      : guardian?.email || "Encargado";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hogar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vista del encargado: {guardianName}
        </p>
      </div>
      <GuardianSelector academyId={profile.academy_id} />
      <HogarContent
        guardianId={params.guardianId}
        guardianName={guardianName}
      />
    </div>
  );
}
