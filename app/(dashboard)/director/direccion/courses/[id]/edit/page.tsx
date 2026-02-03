"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Turno = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(false);
  const [loadCourse, setLoadCourse] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectName, setSubjectName] = useState("");
  const [professorName, setProfessorName] = useState("");
  const [yearPeriod, setYearPeriod] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessionDates, setSessionDates] = useState<string[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);

  const [newDay, setNewDay] = useState<number>(1);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const r = await fetch(`/api/courses/${id}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Error al cargar el curso");
        const c = d.course;
        setSubjectName((c.subject?.name as string) ?? "");
        const p = c.profile as {
          first_name?: string;
          last_name?: string;
          email?: string;
        } | null;
        setProfessorName(
          p
            ? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
                p.email ||
                ""
            : ""
        );
        const per = c.period as { year?: number; period?: string } | null;
        setYearPeriod(per ? `${per.year} – ${per.period}` : "");
        setSessionDates(c.session_dates ?? []);
        setTurnos(
          (c.turnos ?? []).map(
            (t: {
              id?: string;
              day_of_week: number;
              start_time: string;
              end_time: string;
            }) => ({
              id: t.id ?? `t-${Date.now()}-${Math.random()}`,
              day_of_week: t.day_of_week,
              start_time:
                typeof t.start_time === "string"
                  ? t.start_time.slice(0, 5)
                  : "09:00",
              end_time:
                typeof t.end_time === "string"
                  ? t.end_time.slice(0, 5)
                  : "10:00",
            })
          )
        );
        const dates = (c.session_dates ?? []) as string[];
        if (dates.length > 0) {
          const sorted = [...dates].sort();
          setStartDate(sorted[0]);
          setEndDate(sorted[sorted.length - 1]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar");
      } finally {
        setLoadCourse(false);
      }
    })();
  }, [id]);

  function addTurno() {
    if (newStart >= newEnd) {
      setError("La hora de fin debe ser posterior a la de inicio");
      return;
    }
    const dup = turnos.some(
      (t) =>
        t.day_of_week === newDay &&
        t.start_time === newStart &&
        t.end_time === newEnd
    );
    if (dup) {
      setError("Este turno ya está agregado");
      return;
    }
    const hasOverlap = turnos.some((t) => {
      if (t.day_of_week !== newDay) return false;
      const a = new Date(`2000-01-01T${t.start_time}`).getTime();
      const b = new Date(`2000-01-01T${t.end_time}`).getTime();
      const x = new Date(`2000-01-01T${newStart}`).getTime();
      const y = new Date(`2000-01-01T${newEnd}`).getTime();
      return (x >= a && x < b) || (y > a && y <= b) || (x <= a && y >= b);
    });
    if (hasOverlap) {
      setError(
        `Ya hay un turno en ${
          DAY_NAMES[newDay - 1]
        } que se solapa con este horario`
      );
      return;
    }
    setError(null);
    const rec: Turno = {
      id: editingId || `t-${Date.now()}-${Math.random()}`,
      day_of_week: newDay,
      start_time: newStart,
      end_time: newEnd,
    };
    if (editingId) {
      setTurnos((prev) => prev.map((t) => (t.id === editingId ? rec : t)));
      setEditingId(null);
    } else {
      setTurnos((prev) => [...prev, rec]);
    }
    setNewDay(1);
    setNewStart("09:00");
    setNewEnd("10:00");
  }

  function editTurno(tid: string) {
    const t = turnos.find((x) => x.id === tid);
    if (t) {
      setNewDay(t.day_of_week);
      setNewStart(t.start_time);
      setNewEnd(t.end_time);
      setEditingId(tid);
      setError(null);
    }
  }

  function removeTurno(tid: string) {
    setTurnos((prev) => prev.filter((t) => t.id !== tid));
    if (editingId === tid) {
      setEditingId(null);
      setNewDay(1);
      setNewStart("09:00");
      setNewEnd("10:00");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setNewDay(1);
    setNewStart("09:00");
    setNewEnd("10:00");
    setError(null);
  }

  function generateSessionDates() {
    if (!startDate || !endDate) {
      setError("Selecciona fecha de inicio y fin");
      return;
    }
    if (turnos.length === 0) {
      setError(
        "Agrega al menos un turno; sus días se usan para generar las fechas"
      );
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setError("La fecha de fin debe ser posterior o igual a la de inicio");
      return;
    }
    const daysSet = new Set(turnos.map((t) => t.day_of_week));
    const out: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay() === 0 ? 7 : d.getDay();
      if (daysSet.has(dow)) out.push(d.toISOString().split("T")[0]);
    }
    if (out.length === 0) {
      setError(
        "No hay fechas en ese rango para los días de los turnos. Revisa inicio, fin y turnos."
      );
      return;
    }
    setSessionDates(out);
    setError(null);
  }

  function removeSessionDate(i: number) {
    setSessionDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (sessionDates.length === 0) {
      setError("Genera y agrega al menos una fecha de sesión");
      setLoading(false);
      return;
    }
    if (turnos.length === 0) {
      setError("Debes agregar al menos un turno (día y horario)");
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_dates: sessionDates,
          turnos: turnos.map((t) => ({
            day_of_week: t.day_of_week,
            start_time: t.start_time,
            end_time: t.end_time,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          d.details ? `${d.error}: ${d.details}` : d.error || "Error al guardar"
        );
      router.push("/director/direccion/courses");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado al guardar");
      setLoading(false);
    }
  }

  if (loadCourse) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-600">Cargando curso...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar curso</h1>
        <p className="mt-1 text-sm text-gray-500">
          Materia, profesor y periodo no se pueden cambiar. Puedes modificar
          sesiones y turnos.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white shadow rounded-lg p-6 space-y-6"
      >
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Año – Periodo
            </label>
            <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {yearPeriod || "—"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Materia
            </label>
            <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {subjectName || "—"}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Profesor
            </label>
            <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {professorName || "—"}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Turnos (día y horario)
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            La misma clase puede tener distintos horarios, por ejemplo: Martes
            15:00 y Jueves 17:00.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Día
              </label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {DAY_NAMES.map((n, i) => (
                  <option key={i} value={i + 1}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Hora inicio
              </label>
              <input
                type="time"
                min="07:00"
                max="22:00"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Hora fin
              </label>
              <input
                type="time"
                min="07:00"
                max="22:00"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex items-end gap-2">
              {editingId ? (
                <>
                  <button
                    type="button"
                    onClick={addTurno}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={addTurno}
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Agregar turno
                </button>
              )}
            </div>
          </div>
        </div>

        {turnos.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Turnos agregados
            </h4>
            <ul className="space-y-2">
              {turnos
                .sort((a, b) =>
                  a.day_of_week !== b.day_of_week
                    ? a.day_of_week - b.day_of_week
                    : a.start_time.localeCompare(b.start_time)
                )
                .map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-2"
                  >
                    <span className="text-sm">
                      {DAY_NAMES[t.day_of_week - 1]} {t.start_time.slice(0, 5)}{" "}
                      – {t.end_time.slice(0, 5)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => editTurno(t.id)}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTurno(t.id)}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}

        <div className="border-t border-gray-200 pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Fechas de sesiones
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg space-y-4 mb-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="start"
                  className="block text-sm font-medium text-gray-700"
                >
                  Fecha de inicio
                </label>
                <input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="end"
                  className="block text-sm font-medium text-gray-700"
                >
                  Fecha de fin
                </label>
                <input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Se usan los días de la semana de los turnos agregados.
            </p>
            <button
              type="button"
              onClick={generateSessionDates}
              className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Generar fechas
            </button>
          </div>

          {sessionDates.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Fechas agregadas ({sessionDates.length})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sessionDates.map((d, i) => (
                  <div
                    key={`${d}-${i}`}
                    className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {new Date(d).toLocaleDateString("es-ES")}
                    </span>
                    <span className="ml-2 text-sm text-gray-600">- Sesión</span>
                    <button
                      type="button"
                      onClick={() => removeSessionDate(i)}
                      className="text-gray-500 hover:text-gray-700 text-sm font-normal"
                    >
                      Eliminar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link
            href="/director/direccion/courses"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading || sessionDates.length === 0}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
