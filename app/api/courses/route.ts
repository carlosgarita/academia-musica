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

// GET: List courses from courses table
// Query: ?profile_id=uuid (obligatorio para profesores), ?year=number (opcional)
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
    const profileId = searchParams.get("profile_id");
    const yearParam = searchParams.get("year");

    let query = supabaseAdmin
      .from("courses")
      .select(
        `
        id,
        name,
        profile_id,
        year,
        mensualidad,
        academy_id,
        profile:profiles(id, first_name, last_name, email, deleted_at)
      `
      )
      .is("deleted_at", null);

    if (profileId) {
      query = query.eq("profile_id", profileId);
    }
    if (yearParam) {
      const year = parseInt(yearParam, 10);
      if (!Number.isNaN(year)) {
        query = query.eq("year", year);
      }
    }

    const { data: coursesData, error } = await query.order("year", {
      ascending: false,
    });

    if (error) {
      console.error("Error fetching courses:", error);
      return NextResponse.json(
        { error: "Failed to fetch courses", details: error.message },
        { status: 500 }
      );
    }

    // Filter by academy (unless super_admin) and exclude soft-deleted profile
    const filtered = (coursesData || []).filter((c: Record<string, unknown>) => {
      const pr = c.profile as { deleted_at?: string | null } | null;
      const profileArr = Array.isArray(pr) ? pr : pr ? [pr] : [];
      const p = profileArr[0] as { deleted_at?: string | null } | undefined;
      if (profile.role !== "super_admin" && c.academy_id !== profile.academy_id)
        return false;
      if (p?.deleted_at) return false;
      return true;
    });

    // Enrich with session count, turnos count, and session date range
    const courses = await Promise.all(
      filtered.map(async (c: Record<string, unknown>) => {
        const courseId = c.id as string;
        const [sessionsRes, turnosRes, datesRes] = await Promise.all([
          supabaseAdmin
            .from("course_sessions")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId),
          supabaseAdmin
            .from("schedules")
            .select("id", { count: "exact", head: true })
            .eq("course_id", courseId)
            .is("deleted_at", null),
          supabaseAdmin
            .from("course_sessions")
            .select("date")
            .eq("course_id", courseId)
            .order("date", { ascending: true }),
        ]);
        const dates = (datesRes.data || []) as { date: string }[];
        const firstSessionDate = dates.length > 0 ? dates[0].date : null;
        const lastSessionDate =
          dates.length > 0 ? dates[dates.length - 1].date : null;
        return {
          ...c,
          sessions_count: sessionsRes.count ?? 0,
          turnos_count: turnosRes.count ?? 0,
          first_session_date: firstSessionDate,
          last_session_date: lastSessionDate,
        };
      })
    );

    return NextResponse.json({ courses });
  } catch (e) {
    console.error("Unexpected error in GET /api/courses:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a course. New flow: name (text), profile_id, year from start_date, course_sessions, schedules
// Body: { name, profile_id, turnos, session_dates or [start_date, end_date], mensualidad }
// Year is derived from the first session date (or start_date)
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
    const {
      academy_id: bodyAcademyId,
      name,
      profile_id,
      start_date,
      end_date,
      session_dates,
      turnos,
      mensualidad,
    } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "El nombre del curso es obligatorio" },
        { status: 400 }
      );
    }

    if (!profile_id) {
      return NextResponse.json(
        { error: "profile_id es obligatorio" },
        { status: 400 }
      );
    }

    const academyId = profile.academy_id ?? bodyAcademyId ?? null;
    if (!academyId) {
      return NextResponse.json(
        {
          error:
            "academy_id es obligatorio cuando tu cuenta no está vinculada a una academia",
        },
        { status: 400 }
      );
    }

    const useSessionDates =
      Array.isArray(session_dates) && session_dates.length > 0;

    if (!useSessionDates) {
      if (
        !start_date ||
        !end_date ||
        typeof start_date !== "string" ||
        typeof end_date !== "string"
      ) {
        return NextResponse.json(
          {
            error:
              "Indica start_date y end_date, o envía session_dates (fechas de sesiones generadas)",
          },
          { status: 400 }
        );
      }
      const start = new Date(start_date);
      const end = new Date(end_date);
      if (end < start) {
        return NextResponse.json(
          {
            error: "end_date debe ser posterior o igual a start_date",
          },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(turnos) || turnos.length === 0) {
      return NextResponse.json(
        {
          error:
            "turnos debe ser un array con al menos un elemento: { day_of_week, start_time, end_time }",
        },
        { status: 400 }
      );
    }

    for (const t of turnos) {
      if (
        !t.day_of_week ||
        !t.start_time ||
        !t.end_time ||
        t.day_of_week < 1 ||
        t.day_of_week > 7
      ) {
        return NextResponse.json(
          {
            error:
              "Cada turno debe tener day_of_week (1-7), start_time y end_time",
          },
          { status: 400 }
        );
      }
      const s = new Date(`2000-01-01T${t.start_time}`);
      const e = new Date(`2000-01-01T${t.end_time}`);
      if (e <= s) {
        return NextResponse.json(
          {
            error: `En el turno ${
              DAY_NAMES[t.day_of_week - 1]
            }: la hora de fin debe ser posterior a la de inicio`,
          },
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

    // Professor validation
    const { data: prof, error: proferr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, academy_id, deleted_at")
      .eq("id", profile_id)
      .single();

    if (proferr || !prof || prof.deleted_at || prof.role !== "professor") {
      return NextResponse.json(
        { error: "Profesor no encontrado o inválido" },
        { status: 404 }
      );
    }

    if (prof.academy_id !== academyId) {
      return NextResponse.json(
        { error: "El profesor no pertenece a la academia" },
        { status: 400 }
      );
    }

    // mensualidad
    const mensualidadVal =
      mensualidad != null && mensualidad !== ""
        ? Number(mensualidad)
        : null;
    if (
      mensualidadVal != null &&
      (Number.isNaN(mensualidadVal) || mensualidadVal < 0)
    ) {
      return NextResponse.json(
        { error: "mensualidad debe ser un número mayor o igual a 0" },
        { status: 400 }
      );
    }

    // Build session dates and derive year from first date
    let sessionDatesList: string[] = [];
    if (useSessionDates) {
      sessionDatesList = (session_dates as string[]).filter(
        (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      );
    } else {
      const start = new Date(start_date as string);
      const end = new Date(end_date as string);
      const daysSet = new Set<number>(
        turnos.map((t: { day_of_week: number }) => t.day_of_week)
      );
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay() === 0 ? 7 : d.getDay();
        if (daysSet.has(dow)) {
          sessionDatesList.push(d.toISOString().split("T")[0]);
        }
      }
    }

    if (sessionDatesList.length === 0) {
      return NextResponse.json(
        { error: "Debe haber al menos una fecha de sesión" },
        { status: 400 }
      );
    }

    const firstDate = sessionDatesList[0];
    const year = new Date(firstDate).getFullYear();

    // 1) Create course
    const { data: courseRow, error: courseErr } = await supabaseAdmin
      .from("courses")
      .insert({
        academy_id: academyId,
        name: name.trim().slice(0, 200),
        profile_id,
        year,
        mensualidad: mensualidadVal,
      })
      .select("id")
      .single();

    if (courseErr || !courseRow) {
      console.error("Error creating course:", courseErr);
      return NextResponse.json(
        {
          error: "Error al crear el curso",
          details: courseErr?.message ?? "Unknown",
        },
        { status: 500 }
      );
    }

    const courseId = courseRow.id;

    // 2) Create course_sessions
    const sessionInserts = sessionDatesList.map((d) => ({
      course_id: courseId,
      date: d,
    }));

    const { error: sessionsErr } = await supabaseAdmin
      .from("course_sessions")
      .insert(sessionInserts);

    if (sessionsErr) {
      console.error("Error creating course_sessions:", sessionsErr);
      await supabaseAdmin.from("courses").delete().eq("id", courseId);
      return NextResponse.json(
        {
          error: "Error al crear las sesiones",
          details: sessionsErr.message,
        },
        { status: 500 }
      );
    }

    // 3) Create schedules (turnos) with course_id
    const scheduleName = `${name.trim()} ${year}`.slice(0, 100);
    const created: object[] = [];

    for (const t of turnos) {
      const { day_of_week, start_time, end_time } = t;

      // Conflict: same professor, same year, same day, overlapping time
      const { data: conflict } = await supabaseAdmin
        .from("schedules")
        .select("id, name")
        .eq("academy_id", academyId)
        .eq("profile_id", profile_id)
        .eq("day_of_week", day_of_week)
        .is("deleted_at", null)
        .or(
          `and(start_time.lte.${start_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${end_time}),and(start_time.gte.${start_time},end_time.lte.${end_time})`
        )
        .limit(1);

      if (conflict && conflict.length > 0) {
        await supabaseAdmin.from("courses").delete().eq("id", courseId);
        return NextResponse.json(
          {
            error: `El profesor ya tiene una clase en ${
              DAY_NAMES[day_of_week - 1]
            } que se solapa con ${start_time}-${end_time}`,
          },
          { status: 400 }
        );
      }

      const insertData = {
        academy_id: academyId,
        course_id: courseId,
        name: scheduleName,
        profile_id,
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
        await supabaseAdmin.from("courses").delete().eq("id", courseId);
        return NextResponse.json(
          {
            error: "Error al crear el turno",
            details: insErr.message,
          },
          { status: 500 }
        );
      }
      created.push(row);
    }

    return NextResponse.json(
      {
        message: "Curso creado correctamente",
        course_id: courseId,
        session_count: sessionDatesList.length,
        schedules: created,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("Unexpected error in POST /api/courses:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
