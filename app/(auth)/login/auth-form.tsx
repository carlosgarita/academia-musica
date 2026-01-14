"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { createBrowserClient } from "@supabase/ssr";

export default function AuthForm() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Usamos "as any" para decirle a TypeScript que no analice los tipos de Auth
  // Esto soluciona el error de JSX component
  const AuthComponent = Auth as React.ElementType;

  return (
    <AuthComponent
      supabaseClient={supabase}
      appearance={{ theme: ThemeSupa }}
      providers={[]}
      redirectTo={`${
        typeof window !== "undefined" ? window.location.origin : ""
      }/auth/callback`}
    />
  );
}
