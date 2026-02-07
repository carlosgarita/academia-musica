import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DAY_NAMES = [
  "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo",
];

// GET: one course (professor_subject_periods) with period, subject, profile, session_dates, turnos
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: psp, error: pspErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .select(`
        id, profile_id, subject_id, period_id,
        period:periods(id, year, period, academy_id),
        subject:subjects(id, name),
        profile:profiles(id, first_name, last_name, email)
      `)
      .eq("id", id)
      .single();

    if (pspErr || !psp) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const p = psp.period as { academy_id?: string } | null;
    if (profile.role !== "super_admin" && p?.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: dates } = await supabaseAdmin
      .from("period_dates")
      .select("date")
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id)
      .eq("date_type", "clase")
      .is("deleted_at", null)
      .order("date", { ascending: true });

    const { data: scheds } = await supabaseAdmin
      .from("schedules")
      .select("id, day_of_week, start_time, end_time")
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id)
      .eq("profile_id", psp.profile_id)
      .is("deleted_at", null)
      .order("day_of_week")
      .order("start_time");

    const session_dates = (dates || []).map((r) => r.date as string);
    const turnos = (scheds || []).map((s) => ({
      id: s.id,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
    }));

    return NextResponse.json({
      course: {
        ...psp,
        session_dates,
        turnos,
      },
    });
  } catch (e) {
    console.error("GET /api/courses/[id]:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// PATCH: update session_dates and turnos (year, period, subject, professor read-only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: psp, error: pspErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("id, profile_id, subject_id, period_id, period:periods(academy_id, year, period)")
      .eq("id", id)
      .single();

    if (pspErr || !psp) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const periodRow = psp.period as { academy_id?: string; year?: number; period?: string } | null;
    if (profile.role !== "super_admin" && periodRow?.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { session_dates, turnos } = body;

    const useSessionDates = Array.isArray(session_dates) && session_dates.length > 0;
    if (!useSessionDates) {
      return NextResponse.json(
        { error: "session_dates debe ser un array con al menos una fecha (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (!Array.isArray(turnos) || turnos.length === 0) {
      return NextResponse.json(
        { error: "turnos debe ser un array con al menos un elemento: { day_of_week, start_time, end_time }" },
        { status: 400 }
      );
    }

    for (const t of turnos) {
      if (!t.day_of_week || !t.start_time || !t.end_time || t.day_of_week < 1 || t.day_of_week > 7) {
        return NextResponse.json(
          { error: "Cada turno debe tener day_of_week (1-7), start_time y end_time" },
          { status: 400 }
        );
      }
      const s = new Date(`2000-01-01T${t.start_time}`);
      const e = new Date(`2000-01-01T${t.end_time}`);
      if (e <= s) {
        return NextResponse.json(
          { error: `En el turno ${DAY_NAMES[t.day_of_week - 1]}: la hora de fin debe ser posterior a la de inicio` },
          { status: 400 }
        );
      }
      if (t.start_time < "07:00" || t.end_time > "22:00") {
        return NextResponse.json({ error: "Las horas deben estar entre 07:00 y 22:00" }, { status: 400 });
      }
    }

    const { data: subject } = await supabaseAdmin
      .from("subjects")
      .select("id, name")
      .eq("id", psp.subject_id)
      .single();

    const scheduleName = (subject?.name && periodRow
      ? `${subject.name} ${periodRow.year}-${periodRow.period}`
      : "Curso"
    ).slice(0, 100);

    // 1) Borrar period_dates (period_id, subject_id) y schedules (period_id, subject_id, profile_id)
    await supabaseAdmin
      .from("period_dates")
      .delete()
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id);

    await supabaseAdmin
      .from("schedules")
      .delete()
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id)
      .eq("profile_id", psp.profile_id);

    // 2) Insertar period_dates
    const dateInserts = (session_dates as string[]).filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (dateInserts.length > 0) {
      await supabaseAdmin.from("period_dates").insert(
        dateInserts.map((d) => ({
          period_id: psp.period_id,
          date_type: "clase",
          date: d,
          subject_id: psp.subject_id,
          profile_id: psp.profile_id,
          comment: null,
        }))
      );
    }

    // 3) Insertar schedules (necesitamos academy_id)
    const { data: per } = await supabaseAdmin
      .from("periods")
      .select("academy_id")
      .eq("id", psp.period_id)
      .single();

    const academyId = (per as { academy_id?: string } | null)?.academy_id;
    if (!academyId) {
      return NextResponse.json({ error: "Periodo sin academia" }, { status: 500 });
    }

    // Conflicto mismo periodo/día/hora para este profesor
    for (const t of turnos) {
      const { data: conflict } = await supabaseAdmin
        .from("schedules")
        .select("id")
        .eq("academy_id", academyId)
        .eq("profile_id", psp.profile_id)
        .eq("period_id", psp.period_id)
        .eq("day_of_week", t.day_of_week)
        .is("deleted_at", null)
        .or(
          `and(start_time.lte.${t.start_time},end_time.gt.${t.start_time}),and(start_time.lt.${t.end_time},end_time.gte.${t.end_time}),and(start_time.gte.${t.start_time},end_time.lte.${t.end_time})`
        )
        .limit(1);

      if (conflict && conflict.length > 0) {
        return NextResponse.json(
          { error: `En ${periodRow?.year}-${periodRow?.period} el profesor ya tiene una clase en ${DAY_NAMES[t.day_of_week - 1]} que se solapa con ${t.start_time}-${t.end_time}` },
          { status: 400 }
        );
      }

      await supabaseAdmin.from("schedules").insert({
        academy_id: academyId,
        subject_id: psp.subject_id,
        name: scheduleName,
        profile_id: psp.profile_id,
        period_id: psp.period_id,
        day_of_week: t.day_of_week,
        start_time: t.start_time,
        end_time: t.end_time,
      });
    }

    return NextResponse.json({ message: "Curso actualizado" });
  } catch (e) {
    console.error("PATCH /api/courses/[id]:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE: remove professor_subject_periods, its schedules, and period_dates (period_id, subject_id)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: psp, error: pspErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("id, profile_id, subject_id, period_id, period:periods(academy_id)")
      .eq("id", id)
      .single();

    if (pspErr || !psp) {
      return NextResponse.json({ error: "Curso no encontrado" }, { status: 404 });
    }

    const p = psp.period as { academy_id?: string } | null;
    if (profile.role !== "super_admin" && p?.academy_id !== profile.academy_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await supabaseAdmin
      .from("period_dates")
      .delete()
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id);

    await supabaseAdmin
      .from("schedules")
      .delete()
      .eq("period_id", psp.period_id)
      .eq("subject_id", psp.subject_id)
      .eq("profile_id", psp.profile_id);

    await supabaseAdmin.from("professor_subject_periods").delete().eq("id", id);

    return NextResponse.json({ message: "Curso eliminado" });
  } catch (e) {
    console.error("DELETE /api/courses/[id]:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
