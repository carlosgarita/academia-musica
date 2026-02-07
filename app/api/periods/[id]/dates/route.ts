import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// GET: Get all dates for a period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: dates, error } = await supabaseAdmin
      .from("period_dates")
      .select(
        `
        *,
        subject:subjects(id, name, deleted_at)
      `
      )
      .eq("period_id", id)
      .is("deleted_at", null)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching period dates:", error);
      return NextResponse.json(
        { error: "Failed to fetch dates", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ dates: dates || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/periods/[id]/dates:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create one or multiple dates for a period
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = cookies();
    const supabase = await createServerClient(cookieStore);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, academy_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only directors and super admins can create dates
    if (profile.role !== "director" && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use service role to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify period exists and user has access
    const { data: period, error: periodError } = await supabaseAdmin
      .from("periods")
      .select("academy_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (periodError || !period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    // Verify academy access (unless super admin)
    if (
      profile.role !== "super_admin" &&
      period.academy_id !== profile.academy_id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { dates } = body; // Array of date objects

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json(
        { error: "dates must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate and prepare dates for insertion
    const dateInserts: { period_id: string; date_type: string; date: string; subject_id: string | null; profile_id: string | null; comment: string | null }[] = [];
    const clasePairs: { subject_id: string; profile_id: string }[] = [];

    for (const dateItem of dates) {
      const { date_type, date, subject_id, profile_id, comment } = dateItem;

      // Validation
      if (!date_type || !["inicio", "cierre", "feriado", "recital", "clase", "otro"].includes(date_type)) {
        return NextResponse.json(
          { error: "Invalid date_type. Must be: inicio, cierre, feriado, recital, clase, or otro" },
          { status: 400 }
        );
      }

      if (!date || typeof date !== "string") {
        return NextResponse.json(
          { error: "date is required and must be a string (YYYY-MM-DD)" },
          { status: 400 }
        );
      }

      // If date_type is "clase", subject_id and profile_id are required
      if (date_type === "clase" && !subject_id) {
        return NextResponse.json(
          { error: "subject_id is required when date_type is 'clase'" },
          { status: 400 }
        );
      }
      if (date_type === "clase" && !profile_id) {
        return NextResponse.json(
          { error: "profile_id (profesor) is required when date_type is 'clase'" },
          { status: 400 }
        );
      }

      // Validate subject exists if provided
      if (subject_id) {
        const { data: subject, error: subjectError } = await supabaseAdmin
          .from("subjects")
          .select("id, academy_id, deleted_at")
          .eq("id", subject_id)
          .single();

        if (subjectError || !subject || subject.deleted_at) {
          return NextResponse.json(
            { error: "Materia (subject) no encontrada" },
            { status: 404 }
          );
        }

        // Verify subject belongs to same academy
        if (subject.academy_id !== period.academy_id) {
          return NextResponse.json(
            { error: "La materia no pertenece a esta academia" },
            { status: 403 }
          );
        }
      }

      // Validate professor (profile_id) when date_type is "clase"
      if (date_type === "clase" && profile_id) {
        const { data: prof, error: profError } = await supabaseAdmin
          .from("profiles")
          .select("id, role, academy_id, deleted_at")
          .eq("id", profile_id)
          .single();

        if (profError || !prof || prof.deleted_at || prof.role !== "professor") {
          return NextResponse.json(
            { error: "Profesor no encontrado o inválido" },
            { status: 404 }
          );
        }
        if (prof.academy_id !== period.academy_id && profile.role !== "super_admin") {
          return NextResponse.json(
            { error: "El profesor no pertenece a esta academia" },
            { status: 403 }
          );
        }
        // Verificar que el profesor tiene esa materia en professor_subjects
        const { data: ps, error: psErr } = await supabaseAdmin
          .from("professor_subjects")
          .select("profile_id")
          .eq("profile_id", profile_id)
          .eq("subject_id", subject_id)
          .maybeSingle();

        if (psErr || !ps) {
          return NextResponse.json(
            { error: "Este profesor no tiene asignada la materia seleccionada" },
            { status: 400 }
          );
        }
        clasePairs.push({ subject_id, profile_id });
      }

      if (comment && comment.length > 500) {
        return NextResponse.json(
          { error: "comment must be 500 characters or less" },
          { status: 400 }
        );
      }

      dateInserts.push({
        period_id: id,
        date_type,
        date,
        subject_id: subject_id || null,
        profile_id: date_type === "clase" && profile_id ? profile_id : null,
        comment: comment || null,
      });
    }

    // Insert all dates
    const { data: insertedDates, error: insertError } = await supabaseAdmin
      .from("period_dates")
      .insert(dateInserts)
      .select();

    if (insertError) {
      console.error("Error creating period dates:", insertError);
      return NextResponse.json(
        { error: "Failed to create dates", details: insertError.message },
        { status: 500 }
      );
    }

    // Insertar en professor_subject_periods (único por profile_id, subject_id, period_id)
    const seen = new Set<string>();
    for (const { subject_id: sid, profile_id: pid } of clasePairs) {
      const key = `${pid}:${sid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { error: pspErr } = await supabaseAdmin
        .from("professor_subject_periods")
        .insert({ profile_id: pid, subject_id: sid, period_id: id });
      if (pspErr && (pspErr as { code?: string }).code !== "23505") {
        console.error("Error inserting professor_subject_periods:", pspErr);
      }
    }

    return NextResponse.json({ dates: insertedDates }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/periods/[id]/dates:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
