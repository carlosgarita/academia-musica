import Link from "next/link";
import AcademiesList from "./AcademiesList";

export default function AcademiesPage() {
  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Academias</h1>
          <p className="mt-2 text-sm text-gray-700">
            Lista de todas las academias en la plataforma.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <Link
            href="/super-admin/academies/new"
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            Nueva Academia
          </Link>
        </div>
      </div>

      <AcademiesList />
    </div>
  );
}
