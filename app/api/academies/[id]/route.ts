import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

async function requireSuperAdmin() {
  const cookieStore = cookies();
  const supabase = await createServerClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile || profile.role !== "super_admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const { data: academy, error } = await auth.supabase
    .from("academies")
    .select("id, name, address, phone, website, status, currency")
    .eq("id", id)
    .single();

  if (error || !academy) {
    return NextResponse.json({ error: "Academy not found" }, { status: 404 });
  }

  const [ab, ar, as] = await Promise.all([
    auth.supabase.from("academy_badges").select("badge_id").eq("academy_id", id),
    auth.supabase.from("academy_rubrics").select("rubric_id").eq("academy_id", id),
    auth.supabase.from("academy_scales").select("scale_id").eq("academy_id", id),
  ]);

  const badgeIds = (ab.data || []).map((r) => r.badge_id);
  const rubricIds = (ar.data || []).map((r) => r.rubric_id);
  const scaleIds = (as.data || []).map((r) => r.scale_id);

  return NextResponse.json({
    academy: { ...academy, badgeIds, rubricIds, scaleIds },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const allowed = ["name", "address", "phone", "website", "currency"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const badgeIds = body.badgeIds;
  const rubricIds = body.rubricIds;
  const scaleIds = body.scaleIds;

  if (updates.currency && updates.currency !== "CRC" && updates.currency !== "EUR") {
    return NextResponse.json(
      { error: "Invalid currency. Must be CRC or EUR" },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length === 0 && badgeIds === undefined && rubricIds === undefined && scaleIds === undefined) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await auth.supabase
      .from("academies")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      console.error("Error updating academy:", updateError);
      return NextResponse.json(
        { error: "Failed to update academy", details: updateError.message },
        { status: 500 }
      );
    }
  }

  if (Array.isArray(badgeIds) || Array.isArray(rubricIds) || Array.isArray(scaleIds)) {
    if (Array.isArray(badgeIds)) {
      await auth.supabase.from("academy_badges").delete().eq("academy_id", id);
      if (badgeIds.length) {
        await auth.supabase.from("academy_badges").insert(
          badgeIds.map((badge_id: string) => ({ academy_id: id, badge_id }))
        );
      }
    }
    if (Array.isArray(rubricIds)) {
      await auth.supabase.from("academy_rubrics").delete().eq("academy_id", id);
      if (rubricIds.length) {
        await auth.supabase.from("academy_rubrics").insert(
          rubricIds.map((rubric_id: string) => ({ academy_id: id, rubric_id }))
        );
      }
    }
    if (Array.isArray(scaleIds)) {
      await auth.supabase.from("academy_scales").delete().eq("academy_id", id);
      if (scaleIds.length) {
        await auth.supabase.from("academy_scales").insert(
          scaleIds.map((scale_id: string) => ({ academy_id: id, scale_id }))
        );
      }
    }
  }

  return NextResponse.json({ success: true });
}
