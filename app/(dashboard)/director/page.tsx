import { redirect } from "next/navigation";

// Redirect to direccion dashboard by default
export default function DirectorPage() {
  redirect("/director/direccion");
}
