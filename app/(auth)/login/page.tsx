"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const errorParam = searchParams.get("error");
  const [error, setError] = useState<string | null>(errorParam || null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        throw signInError;
      }

      if (!data.session) {
        throw new Error("No se pudo establecer la sesión");
      }

      // Wait a moment for the session to be fully established in cookies
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Simply redirect to root - let the middleware handle role-based routing
      // The middleware will verify the profile and redirect accordingly
      // This avoids RLS issues that can occur when checking profile from client
      window.location.href = "/";
    } catch (err) {
      let errorMessage = "Error al iniciar sesión. Verifica tus credenciales.";

      if (err instanceof Error) {
        const error = err as { message?: string; status?: number };

        // Handle specific Supabase errors
        if (error.message) {
          const msg = error.message.toLowerCase();

          // Rate limiting / Too many attempts
          if (
            msg.includes("too many") ||
            msg.includes("rate limit") ||
            msg.includes("multiple requests") ||
            msg.includes("exceeded") ||
            error.status === 429
          ) {
            errorMessage =
              "Demasiados intentos de inicio de sesión. Por favor, espera unos minutos antes de intentar de nuevo.";
          }
          // Invalid credentials
          else if (
            msg.includes("invalid") ||
            msg.includes("credentials") ||
            msg.includes("email or password")
          ) {
            errorMessage =
              "Email o contraseña incorrectos. Verifica tus credenciales e intenta de nuevo.";
          }
          // Email not confirmed
          else if (
            msg.includes("email not confirmed") ||
            msg.includes("not verified")
          ) {
            errorMessage =
              "Tu email no ha sido confirmado. Por favor, verifica tu correo electrónico.";
          }
          // User not found
          else if (
            msg.includes("user not found") ||
            msg.includes("does not exist")
          ) {
            errorMessage =
              "No existe una cuenta con este email. Verifica tu dirección de correo.";
          }
          // Default: use original message
          else {
            errorMessage = error.message;
          }
        }
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {message && (
            <div className="bg-green-50 text-green-500 p-4 rounded-md">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-500 p-4 rounded-md">{error}</div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link
              href="/forgot-password"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
