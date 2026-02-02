import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function GuardianLayout({
  children,
}: {
  children: React.ReactNode;
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
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "guardian") {
    redirect("/");
  }

  const fullName =
    `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
    "Encargado";

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <Link
                  href="/guardian/hogar"
                  className="text-xl font-bold text-indigo-600"
                >
                  Portal de Encargado
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/guardian/hogar"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Hogar
                </Link>
                <Link
                  href="/guardian/payments"
                  className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
                >
                  Pagos
                </Link>
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <span className="mr-4 text-sm text-gray-700">{fullName}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Cerrar Sesión
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
