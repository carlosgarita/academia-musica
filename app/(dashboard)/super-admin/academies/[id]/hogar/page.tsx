import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function SuperAdminHogarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Fetch guardians for this academy
  const { data: guardians } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("academy_id", id)
    .eq("role", "guardian")
    .is("deleted_at", null)
    .order("first_name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hogar</h1>
        <p className="mt-1 text-sm text-gray-500">Academia: {academy.name}</p>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Selecciona un encargado
          </h2>
          {guardians && guardians.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {guardians.map((g) => {
                const name =
                  [g.first_name, g.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  g.email ||
                  "Sin nombre";
                return (
                  <li key={g.id}>
                    <Link
                      href={`/super-admin/academies/${id}/hogar/${g.id}`}
                      className="block px-4 py-4 hover:bg-gray-50 -mx-4"
                    >
                      <p className="font-medium text-gray-900">{name}</p>
                      <p className="text-sm text-gray-500">{g.email}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-gray-500">
              No hay encargados registrados en esta academia.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
