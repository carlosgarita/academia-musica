import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Helper: Verify guardian has access to a student
async function guardianCanAccessStudent(
  supabaseAdmin: ReturnType<typeof createClient>,
  guardianId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("guardian_students")
    .select("id")
    .eq("guardian_id", guardianId)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

// GET: Get course progress for a student
// Returns evaluations, comments, assignments (with completion status), badges
export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string; registrationId: string } }
) {
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { studentId, registrationId } = params;

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

    // Verify access based on role
    if (profile.role === "guardian") {
      const canAccess = await guardianCanAccessStudent(
        supabaseAdmin,
        user.id,
        studentId
      );
      if (!canAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role === "director") {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("academy_id")
        .eq("id", studentId)
        .maybeSingle();
      if (!student || student.academy_id !== profile.academy_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the registration belongs to this student
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("course_registrations")
      .select(
        `
        id,
        student_id,
        academy_id,
        period_id,
        subject_id,
        status,
        subject:subjects(id, name),
        period:periods(id, year, period)
      `
      )
      .eq("id", registrationId)
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .single();

    if (regErr || !reg) {
      return NextResponse.json(
        { error: "Matrícula no encontrada" },
        { status: 404 }
      );
    }

    const formatDate = (d: string) => {
      try {
        return new Date(d + "T12:00:00").toLocaleDateString("es-CR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      } catch {
        return d;
      }
    };

    // Fetch task completions for this student
    const { data: completionsData } = await supabaseAdmin
      .from("task_completions")
      .select(
        "id, session_assignment_id, session_group_assignment_id, completed_at"
      )
      .eq("student_id", studentId);

    const completedAssignmentIds = new Set(
      (completionsData || [])
        .filter((c: any) => c.session_assignment_id)
        .map((c: any) => c.session_assignment_id)
    );
    const completedGroupAssignmentIds = new Set(
      (completionsData || [])
        .filter((c: any) => c.session_group_assignment_id)
        .map((c: any) => c.session_group_assignment_id)
    );

    // numeric_value -> gauge percentage (user-specified mapping)
    const numericValueToPercent = (n: number | null): number => {
      if (n === null || n === undefined) return 0;
      const map: Record<number, number> = {
        0: 10,
        1: 20,
        2: 50,
        3: 100,
      };
      return map[n] ?? 0;
    };

    // Assigned songs for this registration
    const { data: crSongs } = await supabaseAdmin
      .from("course_registration_songs")
      .select("song_id, song:songs(id, name, deleted_at)")
      .eq("course_registration_id", registrationId);

    const assignedSongs = (crSongs || [])
      .filter((s: any) => s.song && !s.song.deleted_at)
      .map((s: any) => ({
        id: s.song.id,
        name: s.song.name ?? "—",
      }));

    // Rubrics for the academy (dynamic)
    const { data: rubricsData } = await supabaseAdmin
      .from("evaluation_rubrics")
      .select("id, name, display_order")
      .eq("academy_id", reg.academy_id)
      .is("deleted_at", null)
      .order("display_order", { ascending: true });

    const rubrics = (rubricsData || []).map((r: any) => ({
      id: r.id,
      name: r.name ?? "—",
    }));

    // Evaluaciones de canciones
    const { data: evals } = await supabaseAdmin
      .from("song_evaluations")
      .select(
        `
        id,
        period_date_id,
        song_id,
        rubric_id,
        scale_id,
        period_dates(date),
        songs(name),
        evaluation_rubrics(name),
        evaluation_scales(name, numeric_value)
      `
      )
      .eq("course_registration_id", registrationId)
      .order("created_at", { ascending: false });

    const evaluations = (evals || [])
      .filter((e: any) => e.period_dates)
      .map((e: any) => {
        const pd = e.period_dates;
        const song = e.songs;
        const rubric = e.evaluation_rubrics;
        const scale = e.evaluation_scales;
        return {
          id: e.id,
          date: pd?.date,
          dateFormatted: pd?.date ? formatDate(pd.date) : "",
          songName: song?.name ?? "—",
          rubricName: rubric?.name ?? "—",
          scaleName: scale?.name ?? "Sin calificar",
          scaleValue: scale?.numeric_value ?? null,
        };
      })
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Song charts data: gauge (latest per rubric) + timeline (all evals over time)
    const evalsRaw = (evals || []).filter(
      (e: any) => e.period_dates && e.songs
    );
    const songCharts = assignedSongs.map((song) => {
      const songEvals = evalsRaw.filter((e: any) => e.song_id === song.id);
      const hasEvaluations = songEvals.length > 0;

      // Gauge: latest evaluation per rubric (include scale name for display)
      const latestByRubric: Record<
        string,
        {
          rubricId: string;
          rubricName: string;
          percent: number;
          scaleName: string;
        }
      > = {};
      for (const e of songEvals) {
        const rubricId = e.rubric_id;
        if (!rubricId || latestByRubric[rubricId]) continue; // keep first (most recent, evals sorted desc)
        const scale = e.evaluation_scales;
        const percent = numericValueToPercent(scale?.numeric_value ?? null);
        latestByRubric[rubricId] = {
          rubricId,
          rubricName: e.evaluation_rubrics?.name ?? "—",
          percent,
          scaleName: scale?.name ?? "Sin calificar",
        };
      }
      const gaugeData = rubrics.map((r) => ({
        rubricId: r.id,
        rubricName: r.name,
        percent: latestByRubric[r.id]?.percent ?? 0,
        scaleName: latestByRubric[r.id]?.scaleName ?? "Sin calificar",
      }));

      // Timeline: all evals by date; each date has values per rubric
      const byDate: Record<
        string,
        { date: string; dateFormatted: string; values: Record<string, number> }
      > = {};
      for (const e of [...songEvals].reverse()) {
        const pd = e.period_dates;
        const date = pd?.date ?? "";
        if (!date) continue;
        const dateFormatted = formatDate(date);
        if (!byDate[date]) {
          byDate[date] = { date, dateFormatted, values: {} };
        }
        const scale = e.evaluation_scales;
        const percent = numericValueToPercent(scale?.numeric_value ?? null);
        byDate[date].values[e.rubric_id] = percent;
      }
      const timelineData = Object.values(byDate).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      return {
        songId: song.id,
        songName: song.name,
        hasEvaluations,
        gaugeData,
        timelineData,
      };
    });

    // Comentarios del profesor
    const { data: comments } = await supabaseAdmin
      .from("session_comments")
      .select(
        `
        id,
        period_date_id,
        comment,
        period_dates(date)
      `
      )
      .eq("course_registration_id", registrationId)
      .order("updated_at", { ascending: false });

    const commentsList = (comments || [])
      .filter((c: any) => c.period_dates)
      .map((c: any) => ({
        id: c.id,
        date: c.period_dates?.date,
        dateFormatted: c.period_dates?.date
          ? formatDate(c.period_dates.date)
          : "",
        comment: c.comment,
      }))
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Tareas individuales
    const { data: assignments } = await supabaseAdmin
      .from("session_assignments")
      .select(
        `
        id,
        period_date_id,
        assignment_text,
        period_dates(date)
      `
      )
      .eq("course_registration_id", registrationId)
      .order("updated_at", { ascending: false });

    const assignmentsList = (assignments || [])
      .filter((a: any) => a.period_dates)
      .map((a: any) => ({
        id: a.id,
        date: a.period_dates?.date,
        dateFormatted: a.period_dates?.date
          ? formatDate(a.period_dates.date)
          : "",
        assignmentText: a.assignment_text,
        isCompleted: completedAssignmentIds.has(a.id),
      }))
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Tareas grupales
    const { data: periodDatesForCourse } = await supabaseAdmin
      .from("period_dates")
      .select("id, date")
      .eq("period_id", reg.period_id)
      .eq("subject_id", reg.subject_id)
      .eq("date_type", "clase")
      .is("deleted_at", null);

    const periodDateIds = (periodDatesForCourse || []).map((p: any) => p.id);
    const groupAssignmentsList: {
      id: string;
      date: string;
      dateFormatted: string;
      assignmentText: string;
      isGroup: true;
      isCompleted: boolean;
    }[] = [];

    if (periodDateIds.length > 0) {
      const { data: groupAssData } = await supabaseAdmin
        .from("session_group_assignments")
        .select("id, period_date_id, assignment_text")
        .in("period_date_id", periodDateIds);

      const dateById = (periodDatesForCourse || []).reduce(
        (acc: Record<string, string>, p: any) => {
          acc[p.id] = p.date;
          return acc;
        },
        {}
      );

      groupAssignmentsList.push(
        ...(groupAssData || []).map((g: any) => {
          const date = dateById[g.period_date_id] ?? "";
          return {
            id: g.id,
            date,
            dateFormatted: date ? formatDate(date) : "",
            assignmentText: g.assignment_text,
            isGroup: true as const,
            isCompleted: completedGroupAssignmentIds.has(g.id),
          };
        })
      );
      groupAssignmentsList.sort((a, b) =>
        (b.date || "").localeCompare(a.date || "")
      );
    }

    // Badges
    const { data: badgesData } = await supabaseAdmin
      .from("student_badges")
      .select(
        `
        id,
        badge_id,
        assigned_at,
        badge:badges(id, name, virtud, description, frase, image_url, deleted_at)
      `
      )
      .eq("course_registration_id", registrationId)
      .order("assigned_at", { ascending: false });

    const formatDateTime = (d: string) => {
      try {
        return new Date(d).toLocaleDateString("es-CR", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      } catch {
        return d;
      }
    };

    const badgesList = (badgesData || [])
      .filter((r: any) => r.badge && !r.badge.deleted_at)
      .map((r: any) => ({
        id: r.id,
        badgeId: r.badge_id,
        name: r.badge?.name ?? "—",
        virtud: r.badge?.virtud ?? null,
        description: r.badge?.description ?? null,
        frase: r.badge?.frase ?? null,
        imageUrl: r.badge?.image_url ?? null,
        dateFormatted: r.assigned_at ? formatDateTime(r.assigned_at) : "",
      }));

    return NextResponse.json({
      registration: {
        id: reg.id,
        subject: reg.subject,
        period: reg.period,
        status: reg.status,
      },
      evaluations,
      assignedSongs,
      rubrics,
      songCharts,
      comments: commentsList,
      assignments: assignmentsList,
      groupAssignments: groupAssignmentsList,
      badges: badgesList,
    });
  } catch (e) {
    console.error(
      "GET /api/guardian/students/[studentId]/courses/[registrationId]/progress:",
      e
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
