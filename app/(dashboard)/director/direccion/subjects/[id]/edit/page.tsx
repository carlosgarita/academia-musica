import { redirect } from "next/navigation";

/** Materias deprecadas: redirigir a Cursos */
export default function SubjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect("/director/direccion/courses");
}
