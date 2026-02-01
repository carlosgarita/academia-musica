import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

// GET: List courses (professor_subject_periods + period, subject, professor, counts)
// Query: ?period_id=uuid (opcional), ?profile_id=uuid (obligatorio para profesores)
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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

    const profileIdParam = new URL(request.url).searchParams.get("profile_id");
    if (profile.role === "professor") {
      if (!profileIdParam || profileIdParam !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const searchParams = new URL(request.url).searchParams;
    const periodId = searchParams.get("period_id");
    const profileId = searchParams.get("profile_id");

    let query = supabaseAdmin
      .from("professor_subject_periods")
      .select(
        `
        id,
        profile_id,
        subject_id,
        period_id,
        period:periods(id, year, period, academy_id, deleted_at),
        subject:subjects(id, name, deleted_at),
        profile:profiles(id, first_name, last_name, email, deleted_at)
      `
      );

    if (periodId) {
      query = query.eq("period_id", periodId);
    }
    if (profileId) {
      query = query.eq("profile_id", profileId);
    }

    const { data: psp, error } = await query.order("period_id", { ascending: false });

    if (error) {
      console.error("Error fetching courses:", error);
      return NextResponse.json(
        { error: "Failed to fetch courses", details: error.message },
        { status: 500 }
      );
    }

    // Filter by academy (unless super_admin) and exclude soft-deleted
    const filtered = (psp || []).filter((c: { period?: { academy_id?: string; deleted_at?: string | null }; subject?: { deleted_at?: string | null }; profile?: { deleted_at?: string | null } }) => {
      if (profile.role !== "super_admin" && c.period?.academy_id !== profile.academy_id) return false;
      if (c.period?.deleted_at) return false;
      if (c.subject?.deleted_at) return false;
      if (c.profile?.deleted_at) return false;
      return true;
    });

    // Enrich with session count and turnos count
    const courses = await Promise.all(
      filtered.map(async (c: { id?: string; period_id?: string; subject_id?: string; profile_id?: string; period?: { id?: string; year?: number; period?: string }; subject?: { id?: string; name?: string }; profile?: { id?: string; first_name?: string | null; last_name?: string | null; email?: string } }) => {
        const [sessionsRes, turnosRes] = await Promise.all([
          supabaseAdmin
            .from("period_dates")
            .select("id", { count: "exact", head: true })
            .eq("period_id", c.period_id)
            .eq("subject_id", c.subject_id)
            .eq("date_type", "clase")
            .is("deleted_at", null),
          supabaseAdmin
            .from("schedules")
            .select("id", { count: "exact", head: true })
            .eq("period_id", c.period_id)
            .eq("subject_id", c.subject_id)
            .eq("profile_id", c.profile_id)
            .is("deleted_at", null),
        ]);
        return {
          ...c,
          sessions_count: sessionsRes.count ?? 0,
          turnos_count: turnosRes.count ?? 0,
        };
      })
    );

    return NextResponse.json({ courses });
  } catch (e) {
    console.error("Unexpected error in GET /api/courses:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: Create a course. Principal: sesiones (period_dates) para comentarios/calificaciones; luego horarios (schedules/turnos).
// Crea: periodo si no existe, professor_subject_periods, period_dates (sesiones), schedules (día/hora por turno).
// Body: { year, period, subject_id, profile_id, turnos, [session_dates] o [start_date, end_date] }
//   session_dates: string[] (YYYY-MM-DD) — si se envía, se usa para period_dates; si no, se derivan de start_date, end_date y días de turnos.
// Opcional: academy_id (solo super_admin sin academia)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

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
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await request.json();
    const { year, period, academy_id: bodyAcademyId, subject_id, profile_id, start_date, end_date, session_dates, turnos } = body;

    if (year == null || year === "" || typeof year !== "number" || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "year es obligatorio y debe ser un número entre 2000 y 2100" },
        { status: 400 }
      );
    }

    if (!period || !["I", "II", "III", "IV", "V", "VI"].includes(period)) {
      return NextResponse.json(
        { error: "period es obligatorio y debe ser I, II, III, IV, V o VI" },
        { status: 400 }
      );
    }

    if (!subject_id || !profile_id) {
      return NextResponse.json(
        { error: "subject_id y profile_id son obligatorios" },
        { status: 400 }
      );
    }

    const academyId = profile.academy_id ?? bodyAcademyId ?? null;
    if (!academyId) {
      return NextResponse.json(
        { error: "academy_id es obligatorio cuando tu cuenta no está vinculada a una academia" },
        { status: 400 }
      );
    }

    // Resolver o crear el periodo (año + periodo)
    let periodId: string;
    const { data: existing } = await supabaseAdmin
      .from("periods")
      .select("id")
      .eq("academy_id", academyId)
      .eq("year", year)
      .eq("period", period)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      periodId = existing.id;
    } else {
      const { data: deleted } = await supabaseAdmin
        .from("periods")
        .select("id")
        .eq("academy_id", academyId)
        .eq("year", year)
        .eq("period", period)
        .not("deleted_at", "is", null)
        .maybeSingle();

      if (deleted) {
        await supabaseAdmin.from("periods").update({ deleted_at: null }).eq("id", deleted.id);
        periodId = deleted.id;
      } else {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("periods")
          .insert({ academy_id: academyId, year, period })
          .select("id")
          .single();
        if (insErr) {
          if ((insErr as { code?: string }).code === "23505") {
            const { data: race } = await supabaseAdmin
              .from("periods")
              .select("id")
              .eq("academy_id", academyId)
              .eq("year", year)
              .eq("period", period)
              .is("deleted_at", null)
              .single();
            if (race) periodId = race.id;
            else {
              return NextResponse.json({ error: "Error al crear el periodo", details: insErr.message }, { status: 500 });
            }
          } else {
            return NextResponse.json({ error: "Error al crear el periodo", details: insErr.message }, { status: 500 });
          }
        } else {
          periodId = inserted!.id;
        }
      }
    }

    // Obtener el periodo para academy_id y validaciones
    const { data: periodRow, error: perr } = await supabaseAdmin
      .from("periods")
      .select("id, academy_id, year, period")
      .eq("id", periodId)
      .is("deleted_at", null)
      .single();

    if (perr || !periodRow) {
      return NextResponse.json({ error: "Error al obtener el periodo" }, { status: 500 });
    }

    const useSessionDates = Array.isArray(session_dates) && session_dates.length > 0;

    if (!useSessionDates) {
      if (!start_date || !end_date || typeof start_date !== "string" || typeof end_date !== "string") {
        return NextResponse.json(
          { error: "Indica start_date y end_date, o envía session_dates (fechas de sesiones generadas)" },
          { status: 400 }
        );
      }
      const start = new Date(start_date);
      const end = new Date(end_date);
      if (end < start) {
        return NextResponse.json(
          { error: "end_date debe ser posterior o igual a start_date" },
          { status: 400 }
        );
      }
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
        return NextResponse.json(
          { error: "Las horas deben estar entre 07:00 y 22:00" },
          { status: 400 }
        );
      }
    }

    // Subject
    const { data: subject, error: suberr } = await supabaseAdmin
      .from("subjects")
      .select("id, name, academy_id, deleted_at")
      .eq("id", subject_id)
      .single();

    if (suberr || !subject || subject.deleted_at) {
      return NextResponse.json({ error: "Materia no encontrada" }, { status: 404 });
    }

    if (subject.academy_id !== periodRow.academy_id) {
      return NextResponse.json({ error: "La materia no pertenece a la academia del periodo" }, { status: 400 });
    }

    // Professor
    const { data: prof, error: proferr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, academy_id, deleted_at")
      .eq("id", profile_id)
      .single();

    if (proferr || !prof || prof.deleted_at || prof.role !== "professor") {
      return NextResponse.json({ error: "Profesor no encontrado o inválido" }, { status: 404 });
    }

    if (prof.academy_id !== periodRow.academy_id) {
      return NextResponse.json({ error: "El profesor no pertenece a la academia" }, { status: 400 });
    }

    const { data: ps } = await supabaseAdmin
      .from("professor_subjects")
      .select("profile_id")
      .eq("profile_id", profile_id)
      .eq("subject_id", subject_id)
      .maybeSingle();

    if (!ps) {
      return NextResponse.json(
        { error: "Este profesor no tiene asignada la materia seleccionada" },
        { status: 400 }
      );
    }

    // 1) professor_subject_periods (ignorar si ya existe)
    const { error: pspErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .insert({ profile_id, subject_id, period_id: periodId });
    if (pspErr && (pspErr as { code?: string }).code !== "23505") {
      console.error("Error creating professor_subject_periods:", pspErr);
      return NextResponse.json(
        { error: "Error al crear el curso", details: pspErr.message },
        { status: 500 }
      );
    }

    // 2) period_dates: usar session_dates o derivar de start_date, end_date y días de turnos
    let dateInserts: { period_id: string; date_type: string; date: string; subject_id: string; comment: null }[] = [];

    if (useSessionDates) {
      for (const d of session_dates as string[]) {
        if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
          dateInserts.push({ period_id: periodId, date_type: "clase", date: d, subject_id, comment: null });
        }
      }
    } else {
      const start = new Date(start_date as string);
      const end = new Date(end_date as string);
      const daysSet = new Set<number>(turnos.map((t: { day_of_week: number }) => t.day_of_week));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        if (daysSet.has(dow)) {
          dateInserts.push({
            period_id: periodId,
            date_type: "clase",
            date: d.toISOString().split("T")[0],
            subject_id,
            comment: null,
          });
        }
      }
    }

    if (dateInserts.length > 0) {
      const { error: datesErr } = await supabaseAdmin.from("period_dates").insert(dateInserts);
      if (datesErr) {
        console.error("Error creating period_dates:", datesErr);
        return NextResponse.json(
          { error: "Error al crear las sesiones", details: datesErr.message },
          { status: 500 }
        );
      }
    }

    // 3) schedules (turnos): solo para saber en qué día/hora se imparte. Conflicto solo si mismo año, periodo, día y horario.
    const scheduleName = `${subject.name} ${periodRow.year}-${periodRow.period}`.slice(0, 100);
    const created: object[] = [];

    for (const t of turnos) {
      const { day_of_week, start_time, end_time } = t;

      // Conflicto: mismo profesor, mismo periodo (año+periodo), mismo día, rango horario solapado
      const { data: conflict } = await supabaseAdmin
        .from("schedules")
        .select("id, name")
        .eq("academy_id", periodRow.academy_id)
        .eq("profile_id", profile_id)
        .eq("period_id", periodId)
        .eq("day_of_week", day_of_week)
        .is("deleted_at", null)
        .or(
          `and(start_time.lte.${start_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${end_time}),and(start_time.gte.${start_time},end_time.lte.${end_time})`
        )
        .limit(1);

      if (conflict && conflict.length > 0) {
        return NextResponse.json(
          {
            error: `En ${periodRow.year}-${periodRow.period} el profesor ya tiene una clase en ${DAY_NAMES[day_of_week - 1]} que se solapa con ${start_time}-${end_time}`,
          },
          { status: 400 }
        );
      }

      const insertData: {
        academy_id: string;
        subject_id: string;
        name: string;
        profile_id: string;
        period_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
      } = {
        academy_id: periodRow.academy_id,
        subject_id,
        name: scheduleName,
        profile_id,
        period_id: periodId,
        day_of_week,
        start_time,
        end_time,
      };

      const { data: row, error: insErr } = await supabaseAdmin
        .from("schedules")
        .insert(insertData)
        .select()
        .single();

      if (insErr) {
        console.error("Error creating schedule:", insErr);
        return NextResponse.json(
          { error: "Error al crear el turno", details: insErr.message },
          { status: 500 }
        );
      }
      created.push(row);
    }

    return NextResponse.json(
      { message: "Curso creado correctamente", period_dates_count: dateInserts.length, schedules: created },
      { status: 201 }
    );
  } catch (e) {
    console.error("Unexpected error in POST /api/courses:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", details: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
