"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingToken, setIsProcessingToken] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function processToken() {
      setIsProcessingToken(true);
      setError(null);

      // Check for error in query params (from callback)
      const errorParam = searchParams.get("error");
      if (errorParam) {
        setError("Error al procesar el enlace de recuperación: " + decodeURIComponent(errorParam));
        setIsProcessingToken(false);
        return;
      }

      // Supabase sends the token in the URL hash (direct link from email)
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const type = params.get("type");
        const refreshToken = params.get("refresh_token");

        if (accessToken && type === "recovery") {
          try {
            // Set the session with the tokens from the hash
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            if (sessionError) {
              setError("Error al procesar el enlace de recuperación: " + sessionError.message);
              setIsProcessingToken(false);
              return;
            }

            setToken(accessToken);
            setIsProcessingToken(false);
            // Clean up the hash from URL
            window.history.replaceState(null, "", window.location.pathname);
          } catch (err) {
            setError("Error al procesar el enlace de recuperación");
            setIsProcessingToken(false);
          }
          return;
        }
      }

      // Check if we have a code in query params (from callback redirect)
      // This shouldn't happen if redirectTo points directly to reset-password,
      // but we handle it just in case
      const code = searchParams.get("code");
      if (code) {
        // If we have a code, it means we came from callback
        // The session should already be set by the callback
        // Just check if we have a session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setToken(data.session.access_token);
          setIsProcessingToken(false);
          // Clean up the code from URL
          window.history.replaceState(null, "", window.location.pathname);
        } else {
          setError("No se pudo establecer la sesión. Por favor, solicita un nuevo enlace.");
          setIsProcessingToken(false);
        }
        return;
      }

      // Check if user already has a session (from server-side callback)
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setError("Token de recuperación inválido o faltante. Por favor, usa el enlace del email.");
          setIsProcessingToken(false);
          return;
        }
        if (data.session) {
          setToken(data.session.access_token);
          setIsProcessingToken(false);
        } else {
          setError("Token de recuperación inválido o faltante. Por favor, usa el enlace del email.");
          setIsProcessingToken(false);
        }
      } catch (err) {
        setError("Error al verificar la sesión");
        setIsProcessingToken(false);
      }
    }

    processToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!token) {
      setError("Token de recuperación no encontrado");
      setIsLoading(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      setIsLoading(false);
      return;
    }

    try {
      // Update the password using the token
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login?message=Contraseña actualizada exitosamente");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar la contraseña");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="bg-green-50 text-green-500 p-4 rounded-md">
              <p className="font-medium">¡Contraseña actualizada exitosamente!</p>
              <p className="text-sm mt-2">Redirigiendo al login...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Restablecer contraseña
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa tu nueva contraseña
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {isProcessingToken && (
            <div className="bg-blue-50 text-blue-600 p-4 rounded-md">
              <p className="text-sm">Procesando enlace de recuperación...</p>
            </div>
          )}

          {error && !isProcessingToken && (
            <div className="bg-red-50 text-red-500 p-4 rounded-md">{error}</div>
          )}

          {!token && !isProcessingToken && !error && (
            <div className="bg-yellow-50 text-yellow-600 p-4 rounded-md">
              <p className="text-sm">
                No se encontró un token válido. Por favor, usa el enlace del email
                que recibiste.
              </p>
            </div>
          )}

          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="password" className="sr-only">
                Nueva contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Nueva contraseña"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="sr-only">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                maxLength={128}
                autoComplete="new-password"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Confirmar contraseña"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !token || isProcessingToken}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Volver al login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
