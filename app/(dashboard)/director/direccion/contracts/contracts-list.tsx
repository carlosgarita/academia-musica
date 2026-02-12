"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Trash2 } from "lucide-react";
import { useAcademyCurrency } from "@/lib/contexts/AcademyCurrencyContext";

type Guardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type Contract = {
  id: string;
  academy_id: string;
  guardian_id: string;
  monthly_amount: number;
  start_date: string;
  end_date: string;
  created_at: string;
  guardian?: Guardian;
};

interface ContractsListProps {
  academyId: string;
}

function formatName(first: string | null, last: string | null, email?: string): string {
  const f = first || "";
  const l = last || "";
  if (l && f) return `${l} ${f}`.trim();
  if (l) return l;
  if (f) return f;
  return email || "Sin nombre";
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-CR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ContractsList({ academyId: _academyId }: ContractsListProps) {
  const { formatCurrency } = useAcademyCurrency();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContracts();
  }, []);

  async function handleDelete(id: string, fullName: string) {
    if (
      !confirm(
        `¿Estás seguro de que deseas eliminar el contrato de "${fullName}"? Esta acción eliminará el contrato y sus facturas asociadas.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Error al eliminar el contrato");
      }

      loadContracts();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al eliminar el contrato");
    }
  }

  async function loadContracts() {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/contracts");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar contratos");
      }

      setContracts(data.contracts || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar los contratos"
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-600">Cargando contratos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gestiona los contratos financieros con los encargados
        </p>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-gray-500">No hay contratos registrados aún.</p>
          <Link
            href="/director/direccion/course-registrations/special-registrations"
            className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
          >
            Matrículas especiales
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {contracts.map((contract) => {
              const guardian = contract.guardian;
              const fullName = guardian
                ? formatName(
                    guardian.first_name,
                    guardian.last_name,
                    guardian.email
                  )
                : "Encargado desconocido";

              return (
                <li key={contract.id}>
                  <div className="px-4 py-4 sm:px-6 flex justify-between items-center hover:bg-gray-50 group">
                    <Link
                      href={`/director/direccion/contracts/${contract.id}`}
                      className="flex-1 flex items-center gap-3 min-w-0"
                    >
                      <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {fullName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(contract.start_date)} –{" "}
                          {formatDate(contract.end_date)} ·{" "}
                          {formatCurrency(Number(contract.monthly_amount))}/mes
                        </p>
                      </div>
                      <span className="text-gray-400 group-hover:text-gray-600 ml-auto mr-2">→</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(contract.id, fullName)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                      title="Eliminar contrato"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
