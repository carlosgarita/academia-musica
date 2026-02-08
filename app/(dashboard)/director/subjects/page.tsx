import { redirect } from "next/navigation";

/** Materias deprecadas: redirigir a Cursos */
export default function SubjectsPage() {
  redirect("/director/direccion/courses");
}
