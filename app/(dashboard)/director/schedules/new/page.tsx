"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Professor = {
  id: string; // Now this is profile.id
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  status: string;
  academy_id: string;
  additional_info: string | null;
};

type TimeSlot = {
  id: string; // Unique ID for the slot
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

export default function NewSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Add turno form state
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotStartTime, setNewSlotStartTime] = useState("09:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("10:00");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  // Professors list
  const [professors, setProfessors] = useState<Professor[]>([]);

  useEffect(() => {
    loadProfessors();
  }, []);

  async function loadProfessors() {
    try {
      const response = await fetch("/api/professors");
      if (!response.ok) {
        throw new Error("Failed to load professors");
      }
      const data = await response.json();
      setProfessors(data.professors || []);
    } catch (err) {
      console.error("Error loading professors:", err);
    }
  }

  function addTimeSlot() {
    // Validation
    if (newSlotStartTime >= newSlotEndTime) {
      setError("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }

    // Check for duplicates
    const isDuplicate = timeSlots.some(
      (slot) =>
        slot.day_of_week === newSlotDay &&
        slot.start_time === newSlotStartTime &&
        slot.end_time === newSlotEndTime
    );

    if (isDuplicate) {
      setError("Este turno ya ha sido agregado");
      return;
    }

    // Check for overlapping slots on the same day
    const hasOverlap = timeSlots.some((slot) => {
      if (slot.day_of_week !== newSlotDay) return false;

      const slotStart = new Date(`2000-01-01T${slot.start_time}`);
      const slotEnd = new Date(`2000-01-01T${slot.end_time}`);
      const newStart = new Date(`2000-01-01T${newSlotStartTime}`);
      const newEnd = new Date(`2000-01-01T${newSlotEndTime}`);

      return (
        (newStart >= slotStart && newStart < slotEnd) ||
        (newEnd > slotStart && newEnd <= slotEnd) ||
        (newStart <= slotStart && newEnd >= slotEnd)
      );
    });

    if (hasOverlap) {
      setError(
        `Ya existe un turno en ${DAY_NAMES[newSlotDay - 1]} que se solapa con este horario`
      );
      return;
    }

    setError(null);

    const newSlot: TimeSlot = {
      id: editingSlotId || `slot-${Date.now()}-${Math.random()}`,
      day_of_week: newSlotDay,
      start_time: newSlotStartTime,
      end_time: newSlotEndTime,
    };

    if (editingSlotId) {
      // Update existing slot
      setTimeSlots((prev) =>
        prev.map((slot) => (slot.id === editingSlotId ? newSlot : slot))
      );
      setEditingSlotId(null);
    } else {
      // Add new slot
      setTimeSlots((prev) => [...prev, newSlot]);
    }

    // Reset form
    setNewSlotDay(1);
    setNewSlotStartTime("09:00");
    setNewSlotEndTime("10:00");
  }

  function editTimeSlot(slotId: string) {
    const slot = timeSlots.find((s) => s.id === slotId);
    if (slot) {
      setNewSlotDay(slot.day_of_week);
      setNewSlotStartTime(slot.start_time);
      setNewSlotEndTime(slot.end_time);
      setEditingSlotId(slotId);
      setError(null);
    }
  }

  function removeTimeSlot(slotId: string) {
    setTimeSlots((prev) => prev.filter((slot) => slot.id !== slotId));
    if (editingSlotId === slotId) {
      setEditingSlotId(null);
      setNewSlotDay(1);
      setNewSlotStartTime("09:00");
      setNewSlotEndTime("10:00");
    }
  }

  function cancelEdit() {
    setEditingSlotId(null);
    setNewSlotDay(1);
    setNewSlotStartTime("09:00");
    setNewSlotEndTime("10:00");
    setError(null);
  }

  function formatTimeSlot(slot: TimeSlot): string {
    return `${DAY_NAMES[slot.day_of_week - 1]} ${slot.start_time} - ${slot.end_time}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setConflicts([]);
    setLoading(true);

    // Validation
    if (!name.trim()) {
      setError("El nombre de la clase es requerido");
      setLoading(false);
      return;
    }

    if (!professorId) {
      setError("Debes seleccionar un profesor");
      setLoading(false);
      return;
    }

    if (timeSlots.length === 0) {
      setError("Debes agregar al menos un turno");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          profile_id: professorId,
          time_slots: timeSlots.map((slot) => ({
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 207 && data.warnings) {
          // Multi-status with conflicts
          setConflicts(data.warnings);
          if (data.schedules && data.schedules.length > 0) {
            alert(
              "Algunos horarios se crearon exitosamente, pero algunos tuvieron conflictos. Revisa los detalles."
            );
            router.push("/director/schedules");
          } else {
            setError(data.message || "Error al crear horarios");
          }
        } else {
          setError(data.error || data.details || "Error al crear horarios");
        }
        setLoading(false);
        return;
      }

      // Success
      router.push("/director/schedules");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado al crear horarios"
      );
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Horario</h1>
        <p className="mt-1 text-sm text-gray-500">
          Crea un nuevo horario de clase para tu academia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <p className="text-sm font-medium text-yellow-800 mb-2">
              Conflictos detectados:
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {conflicts.map((conflict, idx) => (
                <li key={idx}>{conflict}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-6">
          {/* Class Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Nombre de la Clase <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej: Piano Nivel 1"
            />
            <p className="mt-1 text-xs text-gray-500">Máximo 100 caracteres</p>
          </div>

          {/* Professor */}
          <div>
            <label
              htmlFor="professor"
              className="block text-sm font-medium text-gray-700"
            >
              Profesor Responsable <span className="text-red-500">*</span>
            </label>
            <select
              id="professor"
              name="professor"
              required
              value={professorId}
              onChange={(e) => setProfessorId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Selecciona un profesor</option>
              {professors.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {`${prof.first_name || ""} ${prof.last_name || ""}`.trim() ||
                    prof.email}
                </option>
              ))}
            </select>
          </div>

          {/* Add Time Slot Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Agregar Turno
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label
                  htmlFor="newSlotDay"
                  className="block text-sm font-medium text-gray-700"
                >
                  Día <span className="text-red-500">*</span>
                </label>
                <select
                  id="newSlotDay"
                  value={newSlotDay}
                  onChange={(e) => setNewSlotDay(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  {DAY_NAMES.map((dayName, index) => (
                    <option key={index + 1} value={index + 1}>
                      {dayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="newSlotStartTime"
                  className="block text-sm font-medium text-gray-700"
                >
                  Hora Inicio <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="newSlotStartTime"
                  min="07:00"
                  max="22:00"
                  value={newSlotStartTime}
                  onChange={(e) => setNewSlotStartTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="newSlotEndTime"
                  className="block text-sm font-medium text-gray-700"
                >
                  Hora Fin <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="newSlotEndTime"
                  min="07:00"
                  max="22:00"
                  value={newSlotEndTime}
                  onChange={(e) => setNewSlotEndTime(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              <div className="flex items-end gap-2">
                {editingSlotId ? (
                  <>
                    <button
                      type="button"
                      onClick={addTimeSlot}
                      className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={addTimeSlot}
                    className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Agregar Turno
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Selecciona el día y las horas del turno, luego haz clic en "Agregar Turno"
            </p>
          </div>

          {/* Time Slots List */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Turnos Agregados{" "}
              {timeSlots.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({timeSlots.length})
                </span>
              )}
            </h3>
            {timeSlots.length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                No hay turnos agregados. Agrega al menos un turno para crear el horario.
              </p>
            ) : (
              <div className="space-y-2">
                {timeSlots
                  .sort((a, b) => {
                    if (a.day_of_week !== b.day_of_week) {
                      return a.day_of_week - b.day_of_week;
                    }
                    return a.start_time.localeCompare(b.start_time);
                  })
                  .map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {formatTimeSlot(slot)}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editTimeSlot(slot.id)}
                          className="rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50"
                          title="Editar turno"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTimeSlot(slot.id)}
                          className="rounded-md bg-white px-2 py-1 text-xs font-medium text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50"
                          title="Eliminar turno"
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
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
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creando..." : "Crear Horario"}
          </button>
        </div>
      </form>
    </div>
  );
}
