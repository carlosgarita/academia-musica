import Link from "next/link";

export default function DashboardDirector() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Panel del Director</h1>
      <div className="flex flex-col gap-4 max-w-xs">
        <Link
          href="/director/nuevo-encargado"
          className="p-4 border rounded hover:bg-gray-50 text-center"
        >
          Registrar Encargado
        </Link>

        <Link
          href="/director/nuevo-estudiante"
          className="p-4 border rounded hover:bg-gray-50 text-center"
        >
          Registrar Estudiante
        </Link>
      </div>
    </div>
  );
}
