"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function NuevoEncargado() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const myTenantId = "623b7f5f-98aa-4e91-8d4c-2c05f1efb99e";

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const { error } = await supabase.from("guardians").insert({
      tenant_id: myTenantId,
      full_name: formData.get("nombre"),
      phone_number: formData.get("telefono"),
    });

    if (error) alert("Error: " + error.message);
    else {
      alert("Encargado guardado con éxito");
      router.push("/director");
    }
    setLoading(false);
  }

  return (
    <div className="p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-black">Nuevo Encargado</h2>
      <form onSubmit={guardar} className="space-y-4">
        <input
          name="nombre"
          placeholder="Nombre Completo"
          required
          className="w-full p-3 border rounded text-black"
        />
        <input
          name="telefono"
          placeholder="WhatsApp (ej: +506...)"
          required
          className="w-full p-3 border rounded text-black"
        />
        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white p-3 rounded font-bold"
        >
          {loading ? "Guardando..." : "Guardar Encargado"}
        </button>
      </form>
    </div>
  );
}
