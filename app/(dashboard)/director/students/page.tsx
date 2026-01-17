import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { StudentsList } from "./students-list";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function StudentsPage() {
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
    .select("academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile?.academy_id) {
    redirect("/");
  }

  return (
    <div className="container mx-auto py-10">
      <StudentsList academyId={profile.academy_id} />
    </div>
  );
}
