"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewAcademyPage() {
  const router = useRouter();

  // Academy fields
  const [academyName, setAcademyName] = useState("");
  const [academyAddress, setAcademyAddress] = useState("");
  const [academyPhone, setAcademyPhone] = useState("");
  const [academyWebsite, setAcademyWebsite] = useState("");

  // Director fields
  const [directorFirstName, setDirectorFirstName] = useState("");
  const [directorLastName, setDirectorLastName] = useState("");
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [directorPassword, setDirectorPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/academies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          academyName,
          academyAddress,
          academyPhone,
          academyWebsite,
          directorFirstName,
          directorLastName,
          directorEmail,
          directorPhone,
          directorPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.details
          ? `${data.error || "Error"}: ${data.details}`
          : data.error || "Failed to create academy";
        throw new Error(errorMessage);
      }

      router.push("/super-admin/academies");
      router.refresh();
    } catch (err) {
      console.error("Error creating academy:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "An unexpected error occurred. Please check the console for details."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Nueva Academia</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea una nueva academia y su director en la plataforma.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Academy Information Section */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Información de la Academia
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="academyName"
                className="block text-sm font-medium text-gray-700"
              >
                Nombre de la Academia <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="academyName"
                  id="academyName"
                  required
                  maxLength={100}
                  value={academyName}
                  onChange={(e) => setAcademyName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Máximo 100 caracteres
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="academyAddress"
                className="block text-sm font-medium text-gray-700"
              >
                Dirección
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="academyAddress"
                  id="academyAddress"
                  maxLength={200}
                  value={academyAddress}
                  onChange={(e) => setAcademyAddress(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Máximo 200 caracteres
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="academyPhone"
                className="block text-sm font-medium text-gray-700"
              >
                Teléfono
              </label>
              <div className="mt-1">
                <input
                  type="tel"
                  name="academyPhone"
                  id="academyPhone"
                  value={academyPhone}
                  onChange={(e) => setAcademyPhone(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="academyWebsite"
                className="block text-sm font-medium text-gray-700"
              >
                Dirección Web
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="academyWebsite"
                  id="academyWebsite"
                  placeholder="ejemplo.com"
                  maxLength={200}
                  value={academyWebsite}
                  onChange={(e) => setAcademyWebsite(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Máximo 200 caracteres
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Director Information Section */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Información del Director/Dueño
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="directorFirstName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Nombre <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="directorFirstName"
                    id="directorFirstName"
                    required
                    maxLength={50}
                    value={directorFirstName}
                    onChange={(e) => setDirectorFirstName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="directorLastName"
                  className="block text-sm font-medium text-gray-700"
                >
                  Apellidos <span className="text-red-500">*</span>
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="directorLastName"
                    id="directorLastName"
                    required
                    value={directorLastName}
                    onChange={(e) => setDirectorLastName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="directorEmail"
                className="block text-sm font-medium text-gray-700"
              >
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  name="directorEmail"
                  id="directorEmail"
                  required
                  maxLength={255}
                  value={directorEmail}
                  onChange={(e) => setDirectorEmail(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="directorPhone"
                className="block text-sm font-medium text-gray-700"
              >
                Número de Teléfono
              </label>
              <div className="mt-1">
                <input
                  type="tel"
                  name="directorPhone"
                  id="directorPhone"
                  value={directorPhone}
                  onChange={(e) => setDirectorPhone(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="directorPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Contraseña Inicial <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  name="directorPassword"
                  id="directorPassword"
                  required
                  minLength={6}
                  maxLength={128}
                  value={directorPassword}
                  onChange={(e) => setDirectorPassword(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                El director podrá cambiar su contraseña después de iniciar
                sesión.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear Academia"}
          </button>
        </div>
      </form>
    </div>
  );
}
