import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProfessorSidebar } from "@/components/professor/ProfessorSidebar";
import { ProfessorMainContent } from "@/components/professor/ProfessorMainContent";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function ProfessorLayout({
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
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "professor") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <ProfessorSidebar />
      <ProfessorMainContent>{children}</ProfessorMainContent>
    </div>
  );
}
