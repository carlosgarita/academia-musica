import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { DirectorSidebar } from "@/components/director/DirectorSidebar";
import { SidebarProvider } from "@/components/director/SidebarContext";
import { MainContent } from "@/components/director/MainContent";
import { AcademyCurrencyProvider } from "@/lib/contexts/AcademyCurrencyContext";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function DirectorLayout({
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
    .select("role, academy_id")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "director") {
    redirect("/");
  }

  let currency: "CRC" | "EUR" = "CRC";
  if (profile.academy_id) {
    const { data: academy } = await supabase
      .from("academies")
      .select("currency")
      .eq("id", profile.academy_id)
      .single();
    const c = (academy as { currency?: string } | null)?.currency;
    if (c === "EUR" || c === "CRC") currency = c;
  }

  return (
    <AcademyCurrencyProvider currency={currency}>
      <SidebarProvider>
        <DirectorSidebar />
        <MainContent>{children}</MainContent>
      </SidebarProvider>
    </AcademyCurrencyProvider>
  );
}
