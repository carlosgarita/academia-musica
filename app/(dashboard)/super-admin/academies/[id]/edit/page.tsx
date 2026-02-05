import { redirect } from "next/navigation";

export default async function EditAcademyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params; // satisfies Next.js 15+ Promise<params>
  // TODO: Implement edit functionality; layout already enforces super_admin auth
  redirect("/super-admin/academies");
}
