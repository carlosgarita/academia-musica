import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function GuardianPaymentsPage() {
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

  if (!profile || profile.role !== "guardian") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Pagos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Aquí podrás ver y gestionar los pagos de todos tus estudiantes
        </p>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="text-center">
            <p className="text-gray-500">
              El sistema de pagos estará disponible próximamente.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Aquí podrás ver el estado de pagos, realizar pagos y ver el
              historial de transacciones de todos tus estudiantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
