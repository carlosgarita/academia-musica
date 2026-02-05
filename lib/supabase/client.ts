import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type DbClient = ReturnType<typeof createClient>;
export type Tables = Database["public"]["Tables"];
export type Profiles = Tables["profiles"];
export type Professors = Tables["profiles"]; // Professors are profiles with role=professor
export type Students = Tables["students"];
export type Academies = Tables["academies"];
