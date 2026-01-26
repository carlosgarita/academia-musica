"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// La matrícula se hace desde la lista de cursos, con "Agregar Estudiante" en cada curso.
// Redirigir a la página principal de matrículas.
export default function NewCourseRegistrationPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/director/direccion/course-registrations");
  }, [router]);
  return (
    <div className="flex justify-center py-12">
      <span className="text-gray-600">Redirigiendo a matrículas…</span>
    </div>
  );
}
