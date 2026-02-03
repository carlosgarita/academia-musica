"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Professor = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type Subject = {
  id: string;
  name: string;
};

type ScheduleSlot = {
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

interface EditScheduleFormProps {
  scheduleId: string;
  academyId: string;
}

export function EditScheduleForm({
  scheduleId,
  academyId,
}: EditScheduleFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);

  // Add turno form state
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotStartTime, setNewSlotStartTime] = useState("09:00");
  const [newSlotEndTime, setNewSlotEndTime] = useState("10:00");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  const [professors, setProfessors] = useState<Professor[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  useEffect(() => {
    loadScheduleData();
    loadProfessors();
    loadSubjects();
  }, [scheduleId]);

  async function loadScheduleData() {
    try {
      setIsLoadingData(true);
      // Load the initial schedule
      const response = await fetch(`/api/schedules/${scheduleId}`);
      if (!response.ok) {
        throw new Error("Failed to load schedule");
      }
      const data = await response.json();
      const initialSchedule = data.schedule;

      setSubjectId(initialSchedule.subject_id || "");
      setProfessorId(initialSchedule.profile_id || "");

      // Load all schedules with the same name and profile_id (same class, same professor)
      const allSchedulesResponse = await fetch("/api/schedules");
      if (allSchedulesResponse.ok) {
        const allData = await allSchedulesResponse.json();
        const allSchedules = allData.schedules || [];

        // Filter schedules with same name and profile_id
        const relatedSchedules = allSchedules.filter(
          (s: { name: string; profile_id: string }) =>
            s.name === initialSchedule.name &&
            s.profile_id === initialSchedule.profile_id
        );

        // Convert to slots
        const slots: ScheduleSlot[] = relatedSchedules.map(
          (s: {
            id: string;
            day_of_week: number;
            start_time: string;
            end_time: string;
          }) => ({
            id: s.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time.substring(0, 5),
            end_time: s.end_time.substring(0, 5),
          })
        );

        setScheduleSlots(slots);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al cargar el horario"
      );
    } finally {
      setIsLoadingData(false);
    }
  }

  async function loadProfessors() {
    try {
      const response = await fetch("/api/professors");
      if (!response.ok) throw new Error("Failed to load professors");
      const data = await response.json();
      setProfessors(data.professors || []);
    } catch (err) {
      console.error("Error loading professors:", err);
    }
  }

  async function loadSubjects() {
    try {
      setLoadingSubjects(true);
      const response = await fetch("/api/subjects");
      if (!response.ok) throw new Error("Failed to load subjects");
      const data = await response.json();
      setSubjects(data.subjects || []);
    } catch (err) {
      console.error("Error loading subjects:", err);
    } finally {
      setLoadingSubjects(false);
    }
  }

  function addTimeSlot() {
    if (newSlotStartTime >= newSlotEndTime) {
      setError("La hora de fin debe ser posterior a la hora de inicio");
      return;
    }

    // Check for duplicates
    const isDuplicate = scheduleSlots.some(
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
    const hasOverlap = scheduleSlots.some((slot) => {
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
        `Ya existe un turno en ${
          DAY_NAMES[newSlotDay - 1]
        } que se solapa con este horario`
      );
      return;
    }

    setError(null);

    const newSlot: ScheduleSlot = {
      id: editingSlotId || `new-${Date.now()}-${Math.random()}`,
      day_of_week: newSlotDay,
      start_time: newSlotStartTime,
      end_time: newSlotEndTime,
    };

    if (editingSlotId) {
      // Update existing slot
      setScheduleSlots((prev) =>
        prev.map((slot) => (slot.id === editingSlotId ? newSlot : slot))
      );
      setEditingSlotId(null);
    } else {
      // Add new slot
      setScheduleSlots((prev) => [...prev, newSlot]);
    }

    // Reset form
    setNewSlotDay(1);
    setNewSlotStartTime("09:00");
    setNewSlotEndTime("10:00");
  }

  function editTimeSlot(slotId: string) {
    const slot = scheduleSlots.find((s) => s.id === slotId);
    if (slot) {
      setNewSlotDay(slot.day_of_week);
      setNewSlotStartTime(slot.start_time);
      setNewSlotEndTime(slot.end_time);
      setEditingSlotId(slotId);
      setError(null);
    }
  }

  function removeTimeSlot(slotId: string) {
    setScheduleSlots((prev) => prev.filter((slot) => slot.id !== slotId));
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

  function formatTimeSlot(slot: ScheduleSlot): string {
    return `${DAY_NAMES[slot.day_of_week - 1]} ${slot.start_time} - ${
      slot.end_time
    }`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!subjectId) {
      setError("Debes seleccionar una materia");
      setIsLoading(false);
      return;
    }

    if (!professorId) {
      setError("Debes seleccionar un profesor");
      setIsLoading(false);
      return;
    }

    if (scheduleSlots.length === 0) {
      setError("Debes tener al menos un turno");
      setIsLoading(false);
      return;
    }

    try {
      // Get the selected subject name
      const selectedSubject = subjects.find((s) => s.id === subjectId);
      if (!selectedSubject) {
        setError("Materia no encontrada");
        setIsLoading(false);
        return;
      }

      // Separate existing slots (with real IDs) from new slots (with temp IDs)
      const existingSlots = scheduleSlots.filter(
        (slot) => !slot.id.startsWith("new-")
      );
      const newSlots = scheduleSlots.filter((slot) =>
        slot.id.startsWith("new-")
      );

      // Get original schedule to find all related schedules
      const originalResponse = await fetch(`/api/schedules/${scheduleId}`);
      const originalData = await originalResponse.json();
      const originalSchedule = originalData.schedule;

      // Get all schedules with same name and profile_id
      const allSchedulesResponse = await fetch("/api/schedules");
      const allSchedulesData = await allSchedulesResponse.json();
      const allSchedules = allSchedulesData.schedules || [];
      const originalRelatedSchedules = allSchedules.filter(
        (s: { name: string; profile_id: string }) =>
          s.name === originalSchedule.name &&
          s.profile_id === originalSchedule.profile_id
      );

      // Find schedules to delete (exist in DB but not in current slots)
      const currentSlotIds = existingSlots.map((s) => s.id);
      const schedulesToDelete = originalRelatedSchedules.filter(
        (s: { id: string }) => !currentSlotIds.includes(s.id)
      );

      // Delete removed schedules
      for (const scheduleToDelete of schedulesToDelete) {
        await fetch(`/api/schedules/${scheduleToDelete.id}`, {
          method: "DELETE",
        });
      }

      // Update existing schedules
      for (const slot of existingSlots) {
        await fetch(`/api/schedules/${slot.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject_id: subjectId,
            profile_id: professorId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
          }),
        });
      }

      // Create new schedules
      if (newSlots.length > 0) {
        await fetch("/api/schedules", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject_id: subjectId,
            profile_id: professorId,
            time_slots: newSlots.map((slot) => ({
              day_of_week: slot.day_of_week,
              start_time: slot.start_time,
              end_time: slot.end_time,
            })),
          }),
        });
      }

      router.push("/director/schedules");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al actualizar el horario"
      );
      setIsLoading(false);
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Cargando horario...</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Materia */}
        <div>
          <label
            htmlFor="subjectId"
            className="block text-sm font-medium text-gray-700"
          >
            Nombre de la Clase (Materia) <span className="text-red-500">*</span>
          </label>
          <select
            id="subjectId"
            name="subjectId"
            required
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={loadingSubjects}
            className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">
              {loadingSubjects
                ? "Cargando materias..."
                : "Selecciona una materia"}
            </option>
            {!loadingSubjects &&
              subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>

        {/* Profesor */}
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
      </div>

      {/* Add Time Slot Section */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Agregar/Editar Turno
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
          Selecciona el día y las horas del turno, luego haz clic en "Agregar
          Turno"
        </p>
      </div>

      {/* Time Slots List */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Turnos del Horario{" "}
          {scheduleSlots.length > 0 && (
            <span className="text-sm font-normal text-gray-500">
              ({scheduleSlots.length})
            </span>
          )}
        </h3>
        {scheduleSlots.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No hay turnos agregados. Agrega al menos un turno.
          </p>
        ) : (
          <div className="space-y-2">
            {scheduleSlots
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
                      className="rounded-md bg-white px-2 py-1 text-xs font-normal text-gray-500 shadow-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
                      title="Editar turno"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(slot.id)}
                      className="rounded-md bg-white px-2 py-1 text-xs font-normal text-gray-500 shadow-sm ring-1 ring-inset ring-gray-200 hover:bg-gray-50"
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

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
