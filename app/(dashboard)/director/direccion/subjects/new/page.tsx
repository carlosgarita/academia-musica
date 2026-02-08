import { redirect } from "next/navigation";

/** Materias deprecadas: redirigir a Cursos */
export default function SubjectsNewPage() {
  redirect("/director/direccion/courses/new");
}
