import { redirect } from "next/navigation";

/** Materias deprecadas: redirigir a Cursos */
export default function SubjectEditPage() {
  redirect("/director/direccion/courses");
}
