import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Historial de calificaciones, comentarios y tareas para el expediente
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: registrationId } = await params;
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

    if (
      !profile ||
      (profile.role !== "director" &&
        profile.role !== "professor" &&
        profile.role !== "super_admin")
    ) {
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

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("course_registrations")
      .select("id, student_id, academy_id, period_id, subject_id")
      .eq("id", registrationId)
      .is("deleted_at", null)
      .single();

    if (regErr || !reg) {
      return NextResponse.json(
        { error: "Matrícula no encontrada" },
        { status: 404 }
      );
    }

    if (
      profile.role !== "super_admin" &&
      profile.academy_id &&
      reg.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        evaluation_scales(name)
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
        };
      })
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

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

    // Task completions for this student (individual + group)
    const studentId = reg.student_id;
    const { data: completionsData } = await supabaseAdmin
      .from("task_completions")
      .select("session_assignment_id, session_group_assignment_id")
      .eq("student_id", studentId);
    const completedIndividualIds = new Set(
      (completionsData || [])
        .filter((c: any) => c.session_assignment_id)
        .map((c: any) => c.session_assignment_id)
    );
    const completedGroupIds = new Set(
      (completionsData || [])
        .filter((c: any) => c.session_group_assignment_id)
        .map((c: any) => c.session_group_assignment_id)
    );

    const assignmentsList = (assignments || [])
      .filter((a: any) => a.period_dates)
      .map((a: any) => ({
        id: a.id,
        date: a.period_dates?.date,
        dateFormatted: a.period_dates?.date
          ? formatDate(a.period_dates.date)
          : "",
        assignmentText: a.assignment_text,
        isCompleted: completedIndividualIds.has(a.id),
      }))
      .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""));

    // Badges asignados (historial de badges recibidos en el curso)
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

    // Tareas grupales por sesión (sesiones del curso a las que pertenece esta matrícula)
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
      dateFormatted: string;
      assignmentText: string;
      isGroup: true;
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
            isCompleted: completedGroupIds.has(g.id),
          };
        })
      );
      groupAssignmentsList.sort((a, b) =>
        ((b as { date?: string }).date || "").localeCompare((a as { date?: string }).date || "")
      );
    }

    return NextResponse.json({
      evaluations,
      comments: commentsList,
      assignments: assignmentsList,
      groupAssignments: groupAssignmentsList,
      badges: badgesList,
    });
  } catch (e) {
    console.error("GET /api/course-registrations/[id]/expediente-history:", e);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
