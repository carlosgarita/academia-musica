"use client";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

// Definimos una forma (interface) para el Encargado
interface Guardian {
  id: string;
  full_name: string;
}

export default function NuevoEstudiante() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [guardians, setGuardians] = useState<Guardian[]>([]); // Usamos la interfaz en lugar de 'any'
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const myTenantId = "623b7f5f-98aa-4e91-8d4c-2c05f1efb99e";
  const router = useRouter();

  useEffect(() => {
    const fetchGuardians = async () => {
      const { data } = await supabase
        .from("guardians")
        .select("id, full_name")
        .eq("tenant_id", myTenantId)
        .order("full_name", { ascending: true });

      if (data) setGuardians(data as Guardian[]);
    };
    fetchGuardians();
    // Añadimos 'supabase' y 'myTenantId' como dependencias para quitar el warning
  }, [supabase, myTenantId]);

  async function guardarEstudiante(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId)
      return alert("Por favor selecciona un encargado de la lista");

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    try {
      const { data: student, error: sError } = await supabase
        .from("students")
        .insert({
          tenant_id: myTenantId,
          full_name: formData.get("nombre") as string,
        })
        .select()
        .single();

      if (sError) throw sError;

      const { error: linkError } = await supabase
        .from("student_guardians")
        .insert({
          student_id: student.id,
          guardian_id: selectedId,
          relationship: "Asignado",
        });

      if (linkError) throw linkError;

      // Solo una vez el aviso y la redirección
      alert("Estudiante registrado y vinculado correctamente");
      router.push("/director");
    } catch (err) {
      console.error("Detalle del error:", err);
      alert("Error en el registro. Revisa la consola.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-black">Nuevo Estudiante</h2>
      <form onSubmit={guardarEstudiante} className="space-y-6">
        <input
          name="nombre"
          placeholder="Nombre del Alumno"
          required
          className="w-full p-3 border rounded text-black"
        />

        <div>
          <label className="block text-sm font-bold mb-2 text-gray-700">
            Seleccionar Encargado (Orden Alfabético):
          </label>
          <div className="border rounded-lg h-48 overflow-y-auto bg-gray-50 shadow-inner p-2">
            {guardians.map((g) => (
              <div
                key={g.id}
                onClick={() => setSelectedId(g.id)}
                className={`p-3 mb-1 cursor-pointer rounded transition ${
                  selectedId === g.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-800 hover:bg-blue-50"
                }`}
              >
                {g.full_name}
              </div>
            ))}
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full bg-green-600 text-white p-4 rounded-xl font-bold shadow-lg transition hover:bg-green-700 disabled:bg-gray-400"
        >
          {loading ? "Procesando..." : "Finalizar Registro"}
        </button>
      </form>
    </div>
  );
}
