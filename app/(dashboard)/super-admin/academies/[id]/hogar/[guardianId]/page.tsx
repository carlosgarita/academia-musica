import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { HogarContent } from "@/components/hogar";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function SuperAdminHogarGuardianPage({
  params,
}: {
  params: Promise<{ id: string; guardianId: string }>;
}) {
  const { id, guardianId } = await params;
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
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  // Fetch academy
  const { data: academy } = await supabase
    .from("academies")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!academy) {
    redirect("/super-admin/academies");
  }

  // Fetch guardian data
  const { data: guardian } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, academy_id")
    .eq("id", guardianId)
    .eq("role", "guardian")
    .is("deleted_at", null)
    .single();

  if (!guardian || guardian.academy_id !== id) {
    redirect(`/super-admin/academies/${id}/hogar`);
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
          Academia: {academy.name} • Encargado: {guardianName}
        </p>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/super-admin/academies/${id}/hogar`}
          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
        >
          ← Cambiar encargado
        </Link>
      </div>

      <HogarContent
        guardianId={guardianId}
        guardianName={guardianName}
      />
    </div>
  );
}
