"use client";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="flex justify-between items-center p-4 border-b bg-white">
        <Link href="/director" className="font-bold">
          Mi Academia
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Cerrar Sesión
        </button>
      </nav>
      <main className="flex-1">{children}</main>
    </div>
  );
}
