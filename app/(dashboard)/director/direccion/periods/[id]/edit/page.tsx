"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

type Subject = {
  id: string;
  name: string;
  academy_id: string;
};

type Professor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type PeriodDate = {
  id?: string;
  date_type: "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro";
  date: string;
  subject_id: string | null;
  profile_id?: string | null;
  comment: string | null;
  subject?: { id: string; name: string; deleted_at?: string | null } | null;
  professorDisplayName?: string | null;
};

type Period = {
  id: string;
  academy_id: string;
  year: number;
  period: "I" | "II" | "III" | "IV" | "V" | "VI";
  dates: PeriodDate[];
};

export default function EditPeriodPage() {
  const router = useRouter();
  const params = useParams();
  const periodId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loadingProfessors, setLoadingProfessors] = useState(false);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [periodValue, setPeriodValue] = useState<"I" | "II" | "III" | "IV" | "V" | "VI">("I");
  const [dates, setDates] = useState<PeriodDate[]>([]);

  // Form for adding a single date
  const [dateType, setDateType] = useState<"inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro">("inicio");
  const [date, setDate] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [comment, setComment] = useState<string>("");

  // Multi-date selection mode
  const [multiDateMode, setMultiDateMode] = useState(false);
  const [multiDateType, setMultiDateType] = useState<"inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro">("clase");
  const [multiDateSubjectId, setMultiDateSubjectId] = useState<string>("");
  const [multiDateProfileId, setMultiDateProfileId] = useState<string>("");
  const [multiDateStart, setMultiDateStart] = useState<string>("");
  const [multiDateEnd, setMultiDateEnd] = useState<string>("");
  const [multiDateDays, setMultiDateDays] = useState<number[]>([]);
  const [multiDateComment, setMultiDateComment] = useState<string>("");

  useEffect(() => {
    if (periodId) {
      loadPeriod();
      loadSubjects();
    }
  }, [periodId]);

  const subjectIdForProfessors = multiDateMode ? multiDateSubjectId : selectedSubjectId;
  const isClase = multiDateMode ? multiDateType === "clase" : dateType === "clase";
  useEffect(() => {
    if (isClase && subjectIdForProfessors) {
      setLoadingProfessors(true);
      fetch(`/api/professors?subject_id=${subjectIdForProfessors}`)
        .then((r) => r.json())
        .then((d) => { setProfessors(d.professors || []); })
        .finally(() => { setLoadingProfessors(false); });
    } else {
      setProfessors([]);
    }
  }, [isClase, subjectIdForProfessors]);

  async function loadPeriod() {
    try {
      setLoading(true);
      const response = await fetch(`/api/periods/${periodId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load period");
      }

      setPeriod(data.period);
      setYear(data.period.year);
      setPeriodValue(data.period.period);
      setDates(data.period.dates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading period");
    } finally {
      setLoading(false);
    }
  }

  async function loadSubjects() {
    try {
      setLoadingSubjects(true);
      const subjectsResponse = await fetch("/api/subjects");
      const subjectsData = await subjectsResponse.json();
      if (!subjectsResponse.ok) {
        throw new Error(subjectsData.error || "Failed to load subjects");
      }
      setSubjects(subjectsData.subjects || []);
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
    if (dateType === "clase" && !selectedProfileId) {
      setError("Debes seleccionar un profesor cuando el tipo es 'Clase'");
      return;
    }

    const prof = dateType === "clase" && selectedProfileId ? professors.find((p) => p.id === selectedProfileId) : null;
    const newDate: PeriodDate = {
      date_type: dateType,
      date,
      subject_id: dateType === "clase" ? selectedSubjectId : null,
      profile_id: dateType === "clase" ? selectedProfileId : null,
      comment: comment.trim() || null,
      professorDisplayName: prof ? [prof.first_name, prof.last_name].filter(Boolean).join(" ") || null : null,
    };

    setDates([...dates, newDate]);
    setDate("");
    setSelectedSubjectId("");
    setSelectedProfileId("");
    setComment("");
    setError(null);
  }

  function removeDate(index: number) {
    setDates(dates.filter((_, i) => i !== index));
  }

  async function deleteDate(dateId: string) {
    if (!confirm("¿Estás seguro de que deseas eliminar esta fecha?")) {
      return;
    }

    try {
      const response = await fetch(`/api/periods/${periodId}/dates/${dateId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete date");
      }

      // Remove from local state
      setDates(dates.filter((d) => d.id !== dateId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting date");
    }
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
    if (multiDateType === "clase" && !multiDateProfileId) {
      setError("Debes seleccionar un profesor cuando el tipo es 'Clase'");
      return;
    }

    if (multiDateDays.length === 0) {
      setError("Debes seleccionar al menos un día de la semana");
      return;
    }

    const prof = multiDateType === "clase" && multiDateProfileId ? professors.find((p) => p.id === multiDateProfileId) : null;
    const start = new Date(multiDateStart);
    const end = new Date(multiDateEnd);
    const newDates: PeriodDate[] = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
      if (multiDateDays.includes(dayOfWeek)) {
        newDates.push({
          date_type: multiDateType,
          date: d.toISOString().split("T")[0],
          subject_id: multiDateType === "clase" ? multiDateSubjectId : null,
          profile_id: multiDateType === "clase" ? multiDateProfileId : null,
          comment: multiDateComment.trim() || null,
          professorDisplayName: prof ? [prof.first_name, prof.last_name].filter(Boolean).join(" ") || null : null,
        });
      }
    }

    if (newDates.length === 0) {
      setError("No se generaron fechas. Verifica que los días seleccionados existan en el rango de fechas.");
      return;
    }

    setDates([...dates, ...newDates]);
    setMultiDateStart("");
    setMultiDateEnd("");
    setMultiDateDays([]);
    setMultiDateSubjectId("");
    setMultiDateProfileId("");
    setMultiDateComment("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!period) return;

    setError(null);
    setSubmitting(true);

    try {
      // Update period basic info if changed
      if (year !== period.year || periodValue !== period.period) {
        const periodResponse = await fetch(`/api/periods/${periodId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            year,
            period: periodValue,
          }),
        });

        const periodData = await periodResponse.json();

        if (!periodResponse.ok) {
          throw new Error(periodData.error || "Error al actualizar el cronograma");
        }
      }

      // Get existing dates from server
      const datesResponse = await fetch(`/api/periods/${periodId}/dates`);
      const datesData = await datesResponse.json();

      if (!datesResponse.ok) {
        throw new Error(datesData.error || "Error al cargar las fechas existentes");
      }

      const existingDates = datesData.dates || [];
      const existingDateIds = new Set(existingDates.map((d: PeriodDate) => d.id));

      // Separate dates into: new ones (no id) and existing ones (with id)
      const newDates = dates.filter((d) => !d.id);
      const updatedDates = dates.filter((d) => d.id && existingDateIds.has(d.id));
      const deletedDateIds = existingDates
        .filter((ed: PeriodDate) => !dates.find((d) => d.id === ed.id))
        .map((ed: PeriodDate) => ed.id);

      // Delete removed dates
      for (const dateId of deletedDateIds) {
        await fetch(`/api/periods/${periodId}/dates/${dateId}`, {
          method: "DELETE",
        });
      }

      // Add new dates (incluye profile_id para tipo clase)
      if (newDates.length > 0) {
        const datesPayload = newDates.map((d) => ({
          date_type: d.date_type,
          date: d.date,
          subject_id: d.subject_id,
          comment: d.comment,
          ...(d.date_type === "clase" && d.profile_id ? { profile_id: d.profile_id } : {}),
        }));
        const addResponse = await fetch(`/api/periods/${periodId}/dates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dates: datesPayload,
          }),
        });

        if (!addResponse.ok) {
          const addData = await addResponse.json();
          throw new Error(addData.error || "Error al agregar nuevas fechas");
        }
      }

      // Success
      router.push("/director/direccion/periods");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al actualizar el cronograma"
      );
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando cronograma...</div>
      </div>
    );
  }

  if (error && !period) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Volver
        </button>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cronograma no encontrado</p>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear + i);
  const typeLabels: Record<string, string> = {
    inicio: "Inicio",
    cierre: "Cierre",
    feriado: "Feriado",
    recital: "Recital",
    clase: "Clase",
    otro: "Otro",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar Cronograma</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modifica el cronograma {period.year}-{period.period}
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
                value={periodValue}
                onChange={(e) => setPeriodValue(e.target.value as "I" | "II" | "III" | "IV" | "V" | "VI")}
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
                      onChange={(e) => {
                        setMultiDateType(e.target.value as "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro");
                        if (e.target.value !== "clase") {
                          setMultiDateSubjectId("");
                          setMultiDateProfileId("");
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

                  {multiDateType === "clase" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Materia <span className="text-red-500">*</span>
                        </label>
                        {loadingSubjects ? (
                          <div className="mt-1 text-sm text-gray-500">Cargando...</div>
                        ) : (
                          <select
                            value={multiDateSubjectId}
                            onChange={(e) => {
                              setMultiDateSubjectId(e.target.value);
                              setMultiDateProfileId("");
                            }}
                            required
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Profesor <span className="text-red-500">*</span>
                        </label>
                        {!multiDateSubjectId ? (
                          <div className="mt-1 text-sm text-gray-500">Primero selecciona una materia</div>
                        ) : loadingProfessors ? (
                          <div className="mt-1 text-sm text-gray-500">Cargando...</div>
                        ) : (
                          <select
                            value={multiDateProfileId}
                            onChange={(e) => setMultiDateProfileId(e.target.value)}
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          >
                            <option value="">Selecciona un profesor</option>
                            {professors.map((p) => (
                              <option key={p.id} value={p.id}>
                                {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.id}
                              </option>
                            ))}
                            {professors.length === 0 && !loadingProfessors && (
                              <option value="" disabled>Ningún profesor tiene esta materia</option>
                            )}
                          </select>
                        )}
                      </div>
                    </>
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
                      required
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
                      required
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
                        setDateType(e.target.value as "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro");
                        if (e.target.value !== "clase") {
                          setSelectedSubjectId("");
                          setSelectedProfileId("");
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
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Materia <span className="text-red-500">*</span>
                        </label>
                        {loadingSubjects ? (
                          <div className="mt-1 text-sm text-gray-500">Cargando...</div>
                        ) : (
                          <select
                            value={selectedSubjectId}
                            onChange={(e) => {
                              setSelectedSubjectId(e.target.value);
                              setSelectedProfileId("");
                            }}
                            required={dateType === "clase"}
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Profesor <span className="text-red-500">*</span>
                        </label>
                        {!selectedSubjectId ? (
                          <div className="mt-1 text-sm text-gray-500">Primero selecciona una materia</div>
                        ) : loadingProfessors ? (
                          <div className="mt-1 text-sm text-gray-500">Cargando...</div>
                        ) : (
                          <select
                            value={selectedProfileId}
                            onChange={(e) => setSelectedProfileId(e.target.value)}
                            required={dateType === "clase"}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          >
                            <option value="">Selecciona un profesor</option>
                            {professors.map((p) => (
                              <option key={p.id} value={p.id}>
                                {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.id}
                              </option>
                            ))}
                            {professors.length === 0 && !loadingProfessors && (
                              <option value="" disabled>Ningún profesor tiene esta materia</option>
                            )}
                          </select>
                        )}
                      </div>
                    </>
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
                      required
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

            {/* List of dates */}
            {dates.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Fechas ({dates.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dates.map((dateItem, index) => {
                    const subject = dateItem.subject_id
                      ? (dateItem.subject && !dateItem.subject.deleted_at ? dateItem.subject : subjects.find((s) => s.id === dateItem.subject_id))
                      : null;

                    return (
                      <div
                        key={dateItem.id || index}
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
                              ({subject.name}{dateItem.professorDisplayName ? `, ${dateItem.professorDisplayName}` : ""})
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
                          onClick={() => {
                            if (dateItem.id) {
                              deleteDate(dateItem.id);
                            } else {
                              removeDate(index);
                            }
                          }}
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
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
