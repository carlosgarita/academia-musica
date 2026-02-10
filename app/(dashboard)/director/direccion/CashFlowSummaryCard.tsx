"use client";

import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
  }).format(amount);
}

type Summary = {
  year: number;
  month_start: number;
  month_end: number;
  cobrado: number;
  pendiente: number;
  vencido: number;
};

export function CashFlowSummaryCard() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [monthStart, setMonthStart] = useState(1);
  const [monthEnd, setMonthEnd] = useState(12);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          year: String(year),
          month_start: String(monthStart),
          month_end: String(monthEnd),
        });
        const res = await fetch(`/api/director/cash-flow-summary?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar resumen");
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Error al cargar resumen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [year, monthStart, monthEnd]);

  const periodLabel =
    monthStart === monthEnd
      ? MONTH_NAMES[monthStart - 1]
      : `${MONTH_NAMES[monthStart - 1]} – ${MONTH_NAMES[monthEnd - 1]}`;

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex items-center gap-3">
        <Banknote className="h-8 w-8 text-indigo-600" />
        <div>
          <h2 className="text-lg font-medium text-gray-900">
            Resumen de Flujo de Caja
          </h2>
          <p className="text-sm text-gray-500">
            Totales por concepto en el periodo seleccionado (sin mezclar años).
          </p>
        </div>
      </div>
      <div className="border-t border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Mes inicio
            </label>
            <select
              value={monthStart}
              onChange={(e) => setMonthStart(parseInt(e.target.value, 10))}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Mes final
            </label>
            <select
              value={monthEnd}
              onChange={(e) => setMonthEnd(parseInt(e.target.value, 10))}
              className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500 py-4">Cargando resumen...</p>
        ) : summary ? (
          <div className="overflow-hidden rounded-md border border-gray-200">
            <p className="text-xs text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-200">
              {summary.year} · {periodLabel}
            </p>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Concepto
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Monto
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    Cobrado
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 tabular-nums">
                    {formatCurrency(summary.cobrado)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    Pendiente
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 tabular-nums">
                    {formatCurrency(summary.pendiente)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    Vencido
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-red-600 font-medium tabular-nums">
                    {formatCurrency(summary.vencido)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
