import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function ProfessorAulaPage() {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "professor") {
    redirect("/");
  }

  redirect(`/professor/aula/${profile.id}`);
}
