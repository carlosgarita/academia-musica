import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export default async function EditAcademyPage({
  params,
}: {
  params: { id: string };
}) {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  // For now, redirect to the list page
  // TODO: Implement edit functionality
  redirect("/super-admin/academies");
}
