import { createServerClient as _createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CookieOptions } from "@supabase/ssr";
import type { Database } from "../database.types";

export async function createServerClient(
  cookieStore: ReturnType<typeof cookies>
) {
  const cookieData = await cookieStore;

  return _createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieData.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieData.set(name, value, options);
          } catch (error) {
            // Handle cookie setting error
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieData.set(name, "", { ...options, maxAge: 0 });
          } catch (error) {
            // Handle cookie removal error
          }
        },
      },
    }
  );
}
