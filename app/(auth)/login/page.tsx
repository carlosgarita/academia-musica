"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMensaje("Intentando conectar...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMensaje(`Error: ${error.message}`);
      } else if (data.user) {
        setMensaje("¡Login exitoso! Redirigiendo...");
        // Forzamos el refresco para que el middleware actúe
        window.location.href = "/director";
      }
    } catch (err) {
      setMensaje("Error inesperado de conexión");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleLogin}
        className="p-8 bg-white shadow-lg rounded-xl w-96"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-black">
          Academia Login
        </h1>

        <input
          type="email"
          placeholder="Tu correo"
          className="w-full p-3 mb-4 border rounded text-black"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Tu contraseña"
          className="w-full p-3 mb-6 border rounded text-black"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Cargando..." : "Entrar"}
        </button>

        {mensaje && (
          <p className="mt-4 text-sm text-center font-medium text-red-600">
            {mensaje}
          </p>
        )}
      </form>
    </div>
  );
}
