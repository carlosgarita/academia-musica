"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { School, Power } from "lucide-react";

export function ProfessorSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isAulaActive = pathname.startsWith("/professor/aula");

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <Link
        href="/professor/aula"
        className="lg:hidden fixed top-4 left-4 z-50 rounded-md p-2 bg-white shadow-md text-gray-600 hover:bg-gray-100"
        aria-label="Menú"
      >
        <School className="h-6 w-6" />
      </Link>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-30">
        {/* Header */}
        <div className="flex items-center h-16 px-4 border-b border-gray-200">
          <Link
            href="/professor/aula"
            className="text-lg font-bold text-indigo-600 flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span>Academia</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-2 space-y-1">
            <div className="px-3 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                MENÚ
              </h3>
            </div>
            <Link
              href="/professor/aula"
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors mx-2 ${
                isAulaActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <School className="h-5 w-5 flex-shrink-0" />
              <span>Aula</span>
            </Link>
          </div>
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 p-2">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Power className="h-5 w-5 flex-shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile: simple top bar when not on desktop */}
      <div className="lg:hidden h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 pl-20">
        <span className="text-sm font-medium text-gray-700">Aula</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Cerrar Sesión
          </button>
        </form>
      </div>
    </>
  );
}
