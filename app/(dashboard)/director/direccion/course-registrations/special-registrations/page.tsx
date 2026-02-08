"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Guardian = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

type Student = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

type Course = {
  id: string;
  subject?: { id: string; name: string };
  profile?: { first_name: string | null; last_name: string | null; email?: string };
  period?: { year: number; period: string };
};

type PendingItem = {
  student_id: string;
  student_name: string;
  course_id: string;
  course_name: string;
};

function formatName(first: string | null, last: string | null, email?: string): string {
  const f = first || "";
  const l = last || "";
  if (l && f) return `${l} ${f}`.trim();
  if (l) return l;
  if (f) return f;
  return email || "Sin nombre";
}

function studentDisplayName(s: Student): string {
  return [s.first_name, s.last_name].filter(Boolean).join(" ").trim() || "Sin nombre";
}

function courseDisplayName(c: Course): string {
  const subject = c.subject?.name ?? "—";
  const period = c.period ? `${c.period.year} – ${c.period.period}` : "";
  return period ? `${subject} (${period})` : subject;
}

export default function SpecialRegistrationsPage() {
  const router = useRouter();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [guardianId, setGuardianId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGuardians();
    loadCourses();
  }, []);

  useEffect(() => {
    if (guardianId) {
      loadStudents(guardianId);
      setStudentId("");
      setCourseId("");
      setPendingItems([]);
    } else {
      setStudents([]);
      setStudentId("");
      setCourseId("");
      setPendingItems([]);
      setStartDate("");
      setEndDate("");
    }
  }, [guardianId]);

  async function loadGuardians() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/guardians");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar encargados");
      setGuardians(data.guardians || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function loadCourses() {
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar cursos");
      setCourses(data.courses || []);
    } catch {
      setCourses([]);
    }
  }

  async function loadStudents(guardId: string) {
    try {
      setLoadingStudents(true);
      const res = await fetch(`/api/guardians/${guardId}/students`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar hijos");
      const assignments = data.assignments || [];
      const list: Student[] = [];
      for (const a of assignments) {
        const s = Array.isArray(a.student) ? a.student[0] : a.student;
        if (s && s.id && s.enrollment_status !== "retirado") {
          list.push({ id: s.id, first_name: s.first_name, last_name: s.last_name });
        }
      }
      setStudents(list);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  function addToPending() {
    if (!studentId || !courseId) return;
    const student = students.find((s) => s.id === studentId);
    const course = courses.find((c) => c.id === courseId);
    if (!student || !course) return;

    const item: PendingItem = {
      student_id: student.id,
      student_name: studentDisplayName(student),
      course_id: course.id,
      course_name: courseDisplayName(course),
    };

    setPendingItems((prev) => [...prev, item]);
    setStudentId("");
    setCourseId("");
  }

  function removeFromPending(index: number) {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guardianId || pendingItems.length === 0 || !monthlyAmount) {
      alert("Completa todos los campos requeridos y agrega al menos un estudiante con curso.");
      return;
    }
    const amount = parseFloat(monthlyAmount);
    if (isNaN(amount) || amount < 0) {
      alert("El monto mensual debe ser un número no negativo.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts/special", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardian_id: guardianId,
          items: pendingItems.map((p) => ({ student_id: p.student_id, course_id: p.course_id })),
          monthly_amount: amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details || "Error al crear contrato");
      router.push(`/director/direccion/contracts/${data.contract.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear contrato");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="text-gray-600">Cargando encargados...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/director/direccion/course-registrations"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Matrículas
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Matrículas Especiales</h1>
        <p className="mt-1 text-sm text-gray-500">
          Contratos con precios especiales. Agrega hijos y cursos, define el monto mensual del contrato.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Encargado <span className="text-red-500">*</span>
          </label>
          <select
            value={guardianId}
            onChange={(e) => setGuardianId(e.target.value)}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">Seleccione un encargado</option>
            {guardians.map((g) => (
              <option key={g.id} value={g.id}>
                {formatName(g.first_name, g.last_name, g.email)}
              </option>
            ))}
            {guardians.length === 0 && (
              <option value="" disabled>
                No hay encargados registrados
              </option>
            )}
          </select>
        </div>

        {guardianId && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seleccionar hijo
                </label>
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loadingStudents}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">
                    {loadingStudents ? "Cargando…" : "Seleccione un hijo"}
                  </option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {studentDisplayName(s)}
                    </option>
                  ))}
                  {!loadingStudents && students.length === 0 && (
                    <option value="" disabled>
                      No hay hijos asignados
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cursos activos
                </label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Seleccione un curso</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {courseDisplayName(c)}
                    </option>
                  ))}
                  {courses.length === 0 && (
                    <option value="" disabled>
                      No hay cursos activos
                    </option>
                  )}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={addToPending}
              disabled={!studentId || !courseId}
              className="rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Agregar Estudiante
            </button>

            {pendingItems.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Estudiantes agregados ({pendingItems.length})
                </h4>
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white max-h-48 overflow-y-auto">
                  {pendingItems.map((item, i) => (
                    <li
                      key={`${item.student_id}-${item.course_id}-${i}`}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <span className="text-sm">
                        <strong>{item.student_name}</strong> – {item.course_name}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromPending(i)}
                        className="text-gray-500 hover:text-red-600 text-sm"
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {pendingItems.length > 0 && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Monto mensual (₡) <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Este monto reemplaza el valor por defecto de los cursos. Es el precio especial del contrato.
              </p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                required
                placeholder="0.00"
                className="block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <p className="text-xs text-gray-500">
              Las fechas de inicio y fin se calcularán automáticamente como la primera y última sesión de todos los cursos incluidos.
            </p>
          </>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving || !guardianId || pendingItems.length === 0 || !monthlyAmount}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Creando…" : "Crear contrato"}
          </button>
          <Link
            href="/director/direccion/course-registrations"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
