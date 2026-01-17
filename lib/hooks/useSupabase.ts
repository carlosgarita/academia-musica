import { useState } from "react";
import { createClient, type DbClient } from "../supabase/client";

export function useSupabase() {
  const [supabase] = useState(() => createClient());
  return supabase;
}

export type { DbClient };
