import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// POST: Create a special contract - creates course_registrations if needed, one contract with custom monthly_amount
// Body: { guardian_id, items: [{ student_id, course_id }], monthly_amount }
// - course_id = professor_subject_periods id
// - Creates course_registrations for each (student, course) that don't exist
// - start_date, end_date = min/max across all courses' session dates
// - monthly_amount overrides course defaults (special pricing)
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

    const academyId = profile.academy_id;
    if (!academyId && profile.role !== "super_admin") {
      return NextResponse.json(
        { error: "Academy not found" },
        { status: 404 }
      );
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
    const { guardian_id, items, monthly_amount } = body;

    if (!guardian_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "guardian_id and items (non-empty array of {student_id, course_id}) are required" },
        { status: 400 }
      );
    }

    if (monthly_amount == null || Number(monthly_amount) < 0) {
      return NextResponse.json(
        { error: "monthly_amount must be a non-negative number" },
        { status: 400 }
      );
    }

    // Verify guardian
    const { data: guardianProfile, error: guardianError } = await supabaseAdmin
      .from("profiles")
      .select("id, academy_id, role")
      .eq("id", guardian_id)
      .eq("role", "guardian")
      .is("deleted_at", null)
      .single();

    if (guardianError || !guardianProfile) {
      return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
    }

    const effectiveAcademyId = guardianProfile.academy_id || academyId;
    if (profile.role !== "super_admin" && guardianProfile.academy_id !== academyId) {
      return NextResponse.json(
        { error: "Guardian does not belong to this academy" },
        { status: 403 }
      );
    }

    // Get guardian's students
    const { data: guardianStudents } = await supabaseAdmin
      .from("guardian_students")
      .select("student_id")
      .eq("guardian_id", guardian_id);

    const guardianStudentIds = (guardianStudents || []).map((gs: { student_id: string }) => gs.student_id);

    const createdRegistrationIds: string[] = [];
    const seenPairs = new Set<string>();
    const uniqueItems = (items as { student_id: string; course_id: string }[]).filter((i) => {
      const key = `${i.student_id}:${i.course_id}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    });
    const courseIds = [...new Set(uniqueItems.map((i) => i.course_id))];

    // Get all courses
    const { data: courses, error: coursesErr } = await supabaseAdmin
      .from("professor_subject_periods")
      .select("id, profile_id, subject_id, period_id")
      .in("id", courseIds);

    if (coursesErr || !courses || courses.length !== courseIds.length) {
      return NextResponse.json(
        { error: "Uno o más cursos no fueron encontrados" },
        { status: 400 }
      );
    }

    type CourseRow = { id: string; profile_id: string; subject_id: string; period_id: string };
    const courseMap = Object.fromEntries(
      (courses as CourseRow[]).map((c) => [c.id, c])
    );

    for (const item of uniqueItems) {
      const { student_id, course_id } = item;
      if (!student_id || !course_id) {
        return NextResponse.json(
          { error: "Cada item debe tener student_id y course_id" },
          { status: 400 }
        );
      }
      if (!guardianStudentIds.includes(student_id)) {
        return NextResponse.json(
          { error: "Uno o más estudiantes no pertenecen al encargado seleccionado" },
          { status: 400 }
        );
      }

      const course = courseMap[course_id] as CourseRow | undefined;
      if (!course) {
        return NextResponse.json({ error: "Curso no encontrado" }, { status: 400 });
      }

      // Check if course_registration exists
      const { data: existing } = await supabaseAdmin
        .from("course_registrations")
        .select("id")
        .eq("student_id", student_id)
        .eq("subject_id", course.subject_id)
        .eq("period_id", course.period_id)
        .eq("profile_id", course.profile_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        createdRegistrationIds.push(existing.id);
      } else {
        // Create course_registration
        const { data: student } = await supabaseAdmin
          .from("students")
          .select("academy_id")
          .eq("id", student_id)
          .single();

        if (!student || student.academy_id !== effectiveAcademyId) {
          return NextResponse.json(
            { error: "El estudiante no pertenece a esta academia" },
            { status: 400 }
          );
        }

        const { data: newReg, error: regErr } = await supabaseAdmin
          .from("course_registrations")
          .insert({
            academy_id: effectiveAcademyId,
            student_id: student_id,
            subject_id: course.subject_id,
            period_id: course.period_id,
            profile_id: course.profile_id,
            status: "active",
          })
          .select("id")
          .single();

        if (regErr) {
          console.error("Error creating course_registration:", regErr);
          return NextResponse.json(
            { error: "Error al crear matrícula", details: regErr.message },
            { status: 500 }
          );
        }
        createdRegistrationIds.push(newReg!.id);
      }
    }

    // Get date range from period_dates for all courses
    const periodSubjectProfiles = (courses as CourseRow[]).map((c) => ({
      period_id: c.period_id,
      subject_id: c.subject_id,
      profile_id: c.profile_id,
    }));

    const allDates: string[] = [];
    for (const { period_id, subject_id, profile_id } of periodSubjectProfiles) {
      const { data: dates } = await supabaseAdmin
        .from("period_dates")
        .select("date")
        .eq("period_id", period_id)
        .eq("subject_id", subject_id)
        .eq("profile_id", profile_id)
        .eq("date_type", "clase")
        .is("deleted_at", null);

      for (const d of dates || []) {
        allDates.push((d as { date: string }).date);
      }
    }

    if (allDates.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron fechas de sesiones para los cursos seleccionados" },
        { status: 400 }
      );
    }

    const sortedDates = [...new Set(allDates)].sort();
    const start_date = sortedDates[0];
    const end_date = sortedDates[sortedDates.length - 1];

    // Create contract
    const { data: contract, error: contractError } = await supabaseAdmin
      .from("contracts")
      .insert({
        academy_id: effectiveAcademyId,
        guardian_id,
        monthly_amount: Number(monthly_amount),
        start_date,
        end_date,
      })
      .select()
      .single();

    if (contractError) {
      console.error("Error creating contract:", contractError);
      return NextResponse.json(
        { error: "Error al crear contrato", details: contractError.message },
        { status: 500 }
      );
    }

    // Create contract_course_registrations
    const ccrInserts = createdRegistrationIds.map((crId) => ({
      contract_id: contract.id,
      course_registration_id: crId,
    }));

    const { error: ccrError } = await supabaseAdmin
      .from("contract_course_registrations")
      .insert(ccrInserts);

    if (ccrError) {
      console.error("Error creating contract_course_registrations:", ccrError);
      await supabaseAdmin.from("contracts").delete().eq("id", contract.id);
      return NextResponse.json(
        { error: "Error al vincular matrículas", details: ccrError.message },
        { status: 500 }
      );
    }

    // Generate invoices
    const start = new Date(start_date);
    const end = new Date(end_date);
    const invoices: { contract_id: string; month: string; amount: number; status: string }[] = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (current <= endMonth) {
      const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-01`;
      invoices.push({
        contract_id: contract.id,
        month: monthStr,
        amount: Number(monthly_amount),
        status: "pendiente",
      });
      current.setMonth(current.getMonth() + 1);
    }

    if (invoices.length > 0) {
      const { error: invError } = await supabaseAdmin
        .from("contract_invoices")
        .insert(invoices);

      if (invError) {
        console.error("Error creating invoices:", invError);
        await supabaseAdmin.from("contract_course_registrations").delete().eq("contract_id", contract.id);
        await supabaseAdmin.from("contracts").delete().eq("id", contract.id);
        return NextResponse.json(
          { error: "Error al crear facturas", details: invError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        contract: {
          ...contract,
          course_registration_ids: createdRegistrationIds,
          invoices_count: invoices.length,
        },
        message: "Contrato creado correctamente",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/contracts/special:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
