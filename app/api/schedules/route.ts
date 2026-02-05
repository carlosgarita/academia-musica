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

// GET: List all schedules for the director's academy
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

    // Get user profile to check role and academy
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

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
    }

    // Build query - get basic schedule data first
    // For directors, we might need to use service role to bypass RLS if policies aren't set up correctly
    let schedules;
    let error;

    // First try with regular client (exclude soft deleted)
    if (profile.role === "super_admin") {
      // Super admin can see all
      const result = await supabase
        .from("schedules")
        .select("*")
        .is("deleted_at", null)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      schedules = result.data;
      error = result.error;
    } else {
      // Director - filter by academy_id (academyId is defined after guard above)
      if (!academyId) {
        return NextResponse.json({ error: "Academy not found" }, { status: 404 });
      }
      const result = await supabase
        .from("schedules")
        .select("*")
        .eq("academy_id", academyId)
        .is("deleted_at", null)
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });
      schedules = result.data;
      error = result.error;

      // If error and it's likely an RLS issue, try with service role
      if (error && (error.code === "42501" || error.message?.includes("policy") || error.message?.includes("permission"))) {
        console.log("RLS error detected, trying with service role...");
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
          const adminResult = await supabaseAdmin
            .from("schedules")
            .select("*")
            .eq("academy_id", academyId)
            .is("deleted_at", null)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true });
          schedules = adminResult.data;
          error = adminResult.error;
        }
      }
    }

    if (error) {
      console.error("Error fetching schedules:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      console.error("User ID:", user.id);
      console.error("Profile:", profile);
      console.error("Academy ID:", academyId);
      return NextResponse.json(
        { 
          error: "Failed to fetch schedules", 
          details: error.message,
          hint: error.hint || null,
          code: error.code || null,
          debug: {
            user_id: user.id,
            profile_role: profile.role,
            academy_id: academyId
          }
        },
        { status: 500 }
      );
    }

    // Now fetch profile data for each schedule using service role to bypass RLS
    let supabaseAdmin: ReturnType<typeof createClient> | undefined;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }

    const schedulesWithProfiles = await Promise.all(
      (schedules || []).map(async (schedule) => {
        // Use admin client if available, otherwise fallback to regular client
        const client = supabaseAdmin || supabase;
        const { data: profileData } = await client
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("id", schedule.profile_id)
          .is("deleted_at", null)
          .single();

        return {
          ...schedule,
          profile: profileData || null,
        };
      })
    );

    return NextResponse.json({ schedules: schedulesWithProfiles });
  } catch (error) {
    console.error("Unexpected error in GET /api/schedules:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new schedule (can create multiple for multiple days)
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

    // Get user profile
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

    let academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      subject_id,
      profile_id,
      time_slots,
      days_of_week,
      start_time,
      end_time,
    } = body;

    if (!profile_id) {
      return NextResponse.json(
        { error: "profile_id is required" },
        { status: 400 }
      );
    }

    // Resolve name: from subject_id (preferred) or from name (legacy)
    let scheduleName: string;
    let resolvedSubjectId: string | null = null;

    if (subject_id) {
      const { data: subject, error: subjectError } = await supabase
        .from("subjects")
        .select("id, name, academy_id")
        .eq("id", subject_id)
        .is("deleted_at", null)
        .single();

      if (subjectError || !subject) {
        return NextResponse.json(
          { error: "Materia no encontrada" },
          { status: 400 }
        );
      }
      if (subject.academy_id !== academyId) {
        return NextResponse.json(
          { error: "La materia no pertenece a esta academia" },
          { status: 400 }
        );
      }
      scheduleName = subject.name;
      resolvedSubjectId = subject.id;
    } else if (name && typeof name === "string" && name.trim()) {
      scheduleName = name.trim();
    } else {
      return NextResponse.json(
        { error: "Se requiere subject_id (materia) o name" },
        { status: 400 }
      );
    }

    // Support both new format (time_slots) and legacy format (days_of_week)
    let slots: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];

    if (time_slots) {
      // New format: array of time slots
      if (!Array.isArray(time_slots) || time_slots.length === 0) {
        return NextResponse.json(
          { error: "time_slots must be a non-empty array" },
          { status: 400 }
        );
      }

      // Validate each slot
      for (const slot of time_slots) {
        if (
          !slot.day_of_week ||
          !slot.start_time ||
          !slot.end_time ||
          typeof slot.day_of_week !== "number" ||
          slot.day_of_week < 1 ||
          slot.day_of_week > 7
        ) {
          return NextResponse.json(
            {
              error: "Invalid time slot format. Each slot must have day_of_week (1-7), start_time, and end_time",
            },
            { status: 400 }
          );
        }

        const start = new Date(`2000-01-01T${slot.start_time}`);
        const end = new Date(`2000-01-01T${slot.end_time}`);
        if (end <= start) {
          return NextResponse.json(
            { error: `end_time must be after start_time for slot on day ${slot.day_of_week}` },
            { status: 400 }
          );
        }

        slots.push({
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
      }
    } else if (days_of_week && start_time && end_time) {
      // Legacy format: single time range for multiple days
      if (!Array.isArray(days_of_week) || days_of_week.length === 0) {
        return NextResponse.json(
          { error: "days_of_week must be a non-empty array" },
          { status: 400 }
        );
      }

      // Validate time range
      const start = new Date(`2000-01-01T${start_time}`);
      const end = new Date(`2000-01-01T${end_time}`);
      if (end <= start) {
        return NextResponse.json(
          { error: "end_time must be after start_time" },
          { status: 400 }
        );
      }

      // Convert to time_slots format
      slots = days_of_week.map((day: number) => ({
        day_of_week: day,
        start_time,
        end_time,
      }));
    } else {
      return NextResponse.json(
        { error: "Must provide either time_slots array or days_of_week with start_time and end_time" },
        { status: 400 }
      );
    }

    // Check for conflicts before creating
    const createdSchedules = [];
    const errors = [];

    // Use service role for RPC calls to avoid RLS issues
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: missing service role key" },
        { status: 500 }
      );
    }

    // Schedule creation requires academy_id (from profile or subject)
    if (!academyId && resolvedSubjectId) {
      const { data: subj } = await supabase
        .from("subjects")
        .select("academy_id")
        .eq("id", resolvedSubjectId)
        .single();
      academyId = subj?.academy_id ?? null;
    }
    if (!academyId) {
      return NextResponse.json(
        { error: "Academy is required to create schedules" },
        { status: 400 }
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

    for (const slot of slots) {
      const { day_of_week, start_time: slotStartTime, end_time: slotEndTime } = slot;
      
      // Check for conflicts manually (professor at same time, or student conflicts)
      // First check: professor already has a schedule at this time (exclude soft deleted)
      const { data: professorConflict, error: profConflictError } = await supabaseAdmin
        .from("schedules")
        .select("id, name")
        .eq("academy_id", academyId)
        .eq("profile_id", profile_id)
        .eq("day_of_week", day_of_week)
        .is("deleted_at", null)
        .or(
          `and(start_time.lte.${slotStartTime},end_time.gt.${slotStartTime}),and(start_time.lt.${slotEndTime},end_time.gte.${slotEndTime}),and(start_time.gte.${slotStartTime},end_time.lte.${slotEndTime})`
        )
        .limit(1);

      if (profConflictError) {
        console.error("Error checking professor conflicts:", profConflictError);
        errors.push(`Error verificando conflictos para el día ${day_of_week}: ${profConflictError.message}`);
        continue;
      }

      if (professorConflict && professorConflict.length > 0) {
        const conflict = professorConflict[0];
        errors.push(
          `El profesor ya tiene una clase asignada en este horario: "${conflict.name}" (Día ${DAY_NAMES[day_of_week - 1]})`
        );
        continue;
      }

      // Verify the profile_id is a professor in the same academy (using admin client, exclude soft deleted)
      const { data: professorProfile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, role, academy_id")
        .eq("id", profile_id)
        .eq("role", "professor")
        .is("deleted_at", null)
        .single();

      if (profileError || !professorProfile) {
        errors.push(`Perfil de profesor inválido para el día ${day_of_week}`);
        continue;
      }

      if (professorProfile.academy_id !== academyId) {
        errors.push(`El profesor no pertenece a esta academia (día ${day_of_week})`);
        continue;
      }

      // Create schedule for this day - use service role to bypass RLS
      // Build insert object conditionally - only include subject_id if it exists
      const insertData: {
        academy_id: string;
        name: string;
        profile_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        subject_id?: string | null;
      } = {
        academy_id: academyId,
        name: scheduleName,
        profile_id,
        day_of_week: day_of_week,
        start_time: slotStartTime,
        end_time: slotEndTime,
      };

      // Only add subject_id if we have it (column might not exist in older DBs)
      if (resolvedSubjectId) {
        insertData.subject_id = resolvedSubjectId;
      }

      const { data: schedule, error: createError } = await supabaseAdmin
        .from("schedules")
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        console.error("Error creating schedule:", createError);
        console.error("Schedule data:", insertData);
        
        // Check if error is about missing subject_id column
        const errorMessage = createError.message || "";
        if (errorMessage.includes("subject_id") || errorMessage.includes("column")) {
          return NextResponse.json(
            {
              error: "La columna 'subject_id' no existe en la tabla 'schedules'",
              details: "Por favor ejecuta la migración SQL en Supabase SQL Editor para agregar la columna subject_id a la tabla schedules.",
              migration_sql: `
-- Ejecuta este SQL en Supabase SQL Editor:
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_subject ON public.schedules(subject_id);
              `.trim()
            },
            { status: 500 }
          );
        }
        
        errors.push(
          `Error creando horario para el día ${day_of_week}: ${errorMessage || createError.code || "Error desconocido"}`
        );
        continue;
      }

      createdSchedules.push(schedule);
    }

    if (errors.length > 0 && createdSchedules.length === 0) {
      return NextResponse.json(
        { 
          error: "Failed to create schedules", 
          details: errors,
          message: errors.length === 1 ? errors[0] : `Multiple errors: ${errors.join("; ")}`
        },
        { status: 400 }
      );
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          schedules: createdSchedules,
          warnings: errors,
          message: "Some schedules were created, but some had conflicts",
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json(
      {
        schedules: createdSchedules,
        message: "Schedules created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/schedules:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
