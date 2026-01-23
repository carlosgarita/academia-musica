"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Subject = {
  id: string;
  name: string;
  academy_id: string;
};

type PeriodDate = {
  id?: string;
  date_type: "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro";
  date: string;
  schedule_id: string | null;
  comment: string | null;
};

export default function NewPeriodPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectToScheduleMap, setSubjectToScheduleMap] = useState<Map<string, string>>(new Map());

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [period, setPeriod] = useState<"I" | "II" | "III" | "IV" | "V" | "VI">("I");

  // Form for adding a single date
  const [dateType, setDateType] = useState<"inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro">("inicio");
  const [date, setDate] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  // List of dates added
  const [dates, setDates] = useState<PeriodDate[]>([]);

  // Multi-date selection mode
  const [multiDateMode, setMultiDateMode] = useState(false);
  const [multiDateType, setMultiDateType] = useState<"inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro">("clase");
  const [multiDateSubjectId, setMultiDateSubjectId] = useState("");
  const [multiDateStart, setMultiDateStart] = useState("");
  const [multiDateEnd, setMultiDateEnd] = useState("");
  const [multiDateDays, setMultiDateDays] = useState<number[]>([]);
  const [multiDateComment, setMultiDateComment] = useState("");

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    try {
      setLoadingSubjects(true);
      // Load subjects
      const subjectsResponse = await fetch("/api/subjects");
      const subjectsData = await subjectsResponse.json();

      if (!subjectsResponse.ok) {
        throw new Error(subjectsData.error || "Failed to load subjects");
      }

      setSubjects(subjectsData.subjects || []);

      // Load schedules to map subject_id to schedule_id
      const schedulesResponse = await fetch("/api/schedules");
      const schedulesData = await schedulesResponse.json();

      if (schedulesResponse.ok && schedulesData.schedules) {
        const map = new Map<string, string>();
        // For each subject, find the first active schedule
        subjectsData.subjects.forEach((subject: Subject) => {
          const schedule = schedulesData.schedules.find(
            (s: any) => s.subject_id === subject.id && !s.deleted_at
          );
          if (schedule) {
            map.set(subject.id, schedule.id);
          }
        });
        setSubjectToScheduleMap(map);
      }
    } catch (err) {
      console.error("Error loading subjects:", err);
    } finally {
      setLoadingSubjects(false);
    }
  }

  function addDate() {
    if (!date) {
      setError("Debes seleccionar una fecha");
      return;
    }

    if (dateType === "clase" && !selectedSubjectId) {
      setError("Debes seleccionar una materia cuando el tipo es 'Clase'");
      return;
    }

    // Get schedule_id from subject_id
    const scheduleId = dateType === "clase" ? subjectToScheduleMap.get(selectedSubjectId) || null : null;
    
    if (dateType === "clase" && !scheduleId) {
      setError("No se encontró un horario activo para la materia seleccionada");
      return;
    }

    const newDate: PeriodDate = {
      date_type: dateType,
      date,
      schedule_id: scheduleId,
      comment: comment.trim() || null,
    };

    setDates([...dates, newDate]);
    setDate("");
    setSelectedSubjectId("");
    setComment("");
    setError(null);
  }

  function removeDate(index: number) {
    setDates(dates.filter((_, i) => i !== index));
  }

  function generateMultiDates() {
    if (!multiDateStart || !multiDateEnd) {
      setError("Debes seleccionar fecha de inicio y fin");
      return;
    }

    if (multiDateType === "clase" && !multiDateSubjectId) {
      setError("Debes seleccionar una materia cuando el tipo es 'Clase'");
      return;
    }

    if (multiDateDays.length === 0) {
      setError("Debes seleccionar al menos un día de la semana");
      return;
    }

    // Get schedule_id from subject_id
    const scheduleId = multiDateType === "clase" ? subjectToScheduleMap.get(multiDateSubjectId) || null : null;
    
    if (multiDateType === "clase" && !scheduleId) {
      setError("No se encontró un horario activo para la materia seleccionada");
      return;
    }

    const start = new Date(multiDateStart);
    const end = new Date(multiDateEnd);
    const newDates: PeriodDate[] = [];

    // Generate dates for each selected day of week between start and end
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // Convert Sunday (0) to 7
      if (multiDateDays.includes(dayOfWeek)) {
        newDates.push({
          date_type: multiDateType,
          date: d.toISOString().split("T")[0],
          schedule_id: scheduleId,
          comment: multiDateComment.trim() || null,
        });
      }
    }

    if (newDates.length === 0) {
      setError("No se generaron fechas. Verifica que los días seleccionados existan en el rango de fechas.");
      return;
    }

    setDates([...dates, ...newDates]);
    setMultiDateMode(false);
    setMultiDateStart("");
    setMultiDateEnd("");
    setMultiDateDays([]);
    setMultiDateSubjectId("");
    setMultiDateComment("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (dates.length === 0) {
      setError("Debes agregar al menos una fecha al cronograma");
      setLoading(false);
      return;
    }

    try {
      // Create period first
      const periodResponse = await fetch("/api/periods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year,
          period,
        }),
      });

      const periodData = await periodResponse.json();

      if (!periodResponse.ok) {
        throw new Error(periodData.error || "Error al crear el cronograma");
      }

      // Then create all dates
      const datesResponse = await fetch(`/api/periods/${periodData.period.id}/dates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dates,
        }),
      });

      const datesData = await datesResponse.json();

      if (!datesResponse.ok) {
        // If dates fail, we should probably delete the period, but for now just show error
        throw new Error(datesData.error || "Error al crear las fechas");
      }

      // Success
      router.push("/director/direccion/periods");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al crear el cronograma"
      );
      setLoading(false);
    }
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Cronograma</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea un nuevo cronograma para tu academia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Year and Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="year"
                className="block text-sm font-medium text-gray-700"
              >
                Año <span className="text-red-500">*</span>
              </label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="period"
                className="block text-sm font-medium text-gray-700"
              >
                Periodo <span className="text-red-500">*</span>
              </label>
              <select
                id="period"
                value={period}
                onChange={(e) => setPeriod(e.target.value as "I" | "II" | "III" | "IV" | "V" | "VI")}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="V">V</option>
                <option value="VI">VI</option>
              </select>
            </div>
          </div>

          {/* Dates Section */}
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Fechas del Cronograma</h2>
              <button
                type="button"
                onClick={() => setMultiDateMode(!multiDateMode)}
                className="text-sm text-indigo-600 hover:text-indigo-900"
              >
                {multiDateMode ? "Modo Fecha Individual" : "Agregar Múltiples Fechas"}
              </button>
            </div>

            {multiDateMode ? (
              /* Multi-date mode */
              <div className="bg-gray-50 p-4 rounded-lg space-y-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tipo <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={multiDateType}
                      onChange={(e) => setMultiDateType(e.target.value as any)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="inicio">Fecha de Inicio</option>
                      <option value="cierre">Fecha de Cierre</option>
                      <option value="feriado">Feriado</option>
                      <option value="recital">Recital</option>
                      <option value="clase">Clase</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  {multiDateType === "clase" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Materia <span className="text-red-500">*</span>
                      </label>
                      {loadingSubjects ? (
                        <div className="mt-1 text-sm text-gray-500">Cargando...</div>
                      ) : (
                        <select
                          value={multiDateSubjectId}
                          onChange={(e) => setMultiDateSubjectId(e.target.value)}
                          required={dates.length === 0}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="">Selecciona una materia</option>
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Fecha de Inicio <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={multiDateStart}
                      onChange={(e) => setMultiDateStart(e.target.value)}
                      required={dates.length === 0}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Fecha de Fin <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={multiDateEnd}
                      onChange={(e) => setMultiDateEnd(e.target.value)}
                      required={dates.length === 0}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Días de la Semana <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 1, label: "Lunes" },
                      { value: 2, label: "Martes" },
                      { value: 3, label: "Miércoles" },
                      { value: 4, label: "Jueves" },
                      { value: 5, label: "Viernes" },
                      { value: 6, label: "Sábado" },
                      { value: 7, label: "Domingo" },
                    ].map((day) => (
                      <label key={day.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={multiDateDays.includes(day.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setMultiDateDays([...multiDateDays, day.value]);
                            } else {
                              setMultiDateDays(multiDateDays.filter((d) => d !== day.value));
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Comentario (opcional)
                  </label>
                  <input
                    type="text"
                    value={multiDateComment}
                    onChange={(e) => setMultiDateComment(e.target.value)}
                    maxLength={500}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Comentario para todas las fechas"
                  />
                </div>

                <button
                  type="button"
                  onClick={generateMultiDates}
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Generar Fechas
                </button>
              </div>
            ) : (
              /* Single date mode */
              <div className="bg-gray-50 p-4 rounded-lg space-y-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Selecciona <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={dateType}
                        onChange={(e) => {
                          setDateType(e.target.value as any);
                          if (e.target.value !== "clase") {
                            setSelectedSubjectId("");
                          }
                        }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="inicio">Fecha de Inicio</option>
                      <option value="cierre">Fecha de Cierre</option>
                      <option value="feriado">Feriado</option>
                      <option value="recital">Recital</option>
                      <option value="clase">Clase</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  {dateType === "clase" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Materia <span className="text-red-500">*</span>
                      </label>
                      {loadingSubjects ? (
                        <div className="mt-1 text-sm text-gray-500">Cargando...</div>
                      ) : (
                        <select
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          required={dateType === "clase" && dates.length === 0}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        >
                          <option value="">Selecciona una materia</option>
                          {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Seleccionar Fecha <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required={dates.length === 0}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Comentario (opcional)
                    </label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={500}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Comentario opcional"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addDate}
                  className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  Agregar Fecha
                </button>
              </div>
            )}

            {/* List of added dates */}
            {dates.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Fechas Agregadas ({dates.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dates.map((dateItem, index) => {
                    // Find subject name from schedule_id
                    const subject = dateItem.schedule_id
                      ? subjects.find((s) => subjectToScheduleMap.get(s.id) === dateItem.schedule_id)
                      : null;
                    const typeLabels: Record<string, string> = {
                      inicio: "Inicio",
                      cierre: "Cierre",
                      feriado: "Feriado",
                      recital: "Recital",
                      clase: "Clase",
                      otro: "Otro",
                    };

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white p-3 rounded border border-gray-200"
                      >
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(dateItem.date).toLocaleDateString("es-ES")}
                          </span>
                          <span className="ml-2 text-sm text-gray-600">
                            - {typeLabels[dateItem.date_type]}
                          </span>
                          {subject && (
                            <span className="ml-2 text-sm text-gray-500">
                              ({subject.name})
                            </span>
                          )}
                          {dateItem.comment && (
                            <span className="ml-2 text-sm text-gray-500 italic">
                              - {dateItem.comment}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDate(index)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Eliminar
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || dates.length === 0}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creando..." : "Crear Cronograma"}
          </button>
        </div>
      </form>
    </div>
  );
}
