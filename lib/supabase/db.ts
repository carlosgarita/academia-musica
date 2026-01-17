import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

type DbClient = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];

type DbResult<T> = {
  data: T | null;
  error: Error | null;
};

export function createClient(): DbClient {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createProfile(
  client: DbClient,
  profile: Tables["profiles"]["Insert"]
): Promise<DbResult<Tables["profiles"]["Row"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any;
  const { data, error } = await supabase
    .from("profiles")
    .insert([profile])
    .select()
    .single();

  return {
    data: data as Tables["profiles"]["Row"] | null,
    error,
  };
}

export async function createProfessor(
  client: DbClient,
  professor: Tables["professors"]["Insert"]
): Promise<DbResult<Tables["professors"]["Row"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any;
  const { data, error } = await supabase
    .from("professors")
    .insert([professor])
    .select()
    .single();

  return {
    data: data as Tables["professors"]["Row"] | null,
    error,
  };
}

export async function createStudent(
  client: DbClient,
  student: Tables["students"]["Insert"]
): Promise<DbResult<Tables["students"]["Row"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any;
  const { data, error } = await supabase
    .from("students")
    .insert([student])
    .select()
    .single();

  return {
    data: data as Tables["students"]["Row"] | null,
    error: error ? new Error(error.message || "Error creating student") : null,
  };
}

export async function getProfile(
  client: DbClient,
  userId: string
): Promise<DbResult<Tables["profiles"]["Row"]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any;
  const { data, error } = await supabase
    .from("profiles")
    .select()
    .eq("id", userId)
    .single();

  return {
    data: data as Tables["profiles"]["Row"] | null,
    error,
  };
}

export async function getProfessors(
  client: DbClient,
  academyId: string
): Promise<DbResult<Tables["profiles"]["Row"][]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any;
  // Professors are now just profiles with role='professor'
  const { data, error } = await supabase
    .from("profiles")
    .select()
    .eq("role", "professor")
    .eq("academy_id", academyId)
    .eq("status", "active");

  return {
    data: data as Tables["profiles"]["Row"][] | null,
    error,
  };
}

export async function getStudents(
  client: DbClient,
  academyId: string
): Promise<DbResult<Tables["students"]["Row"][]>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = client as any;
  const { data, error } = await supabase
    .from("students")
    .select()
    .eq("academy_id", academyId);

  return {
    data: data as Tables["students"]["Row"][] | null,
    error,
  };
}
