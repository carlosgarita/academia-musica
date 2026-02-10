import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { billingPeriodStarts } from "@/lib/utils";

// POST: Create course registrations for multiple students and generate contracts per guardian
// Body: { course_id: string, student_ids: string[] }
// course_id references the courses table (new flow)
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
    const {
      course_id,
      student_ids,
      billing_day: bodyBillingDay,
      grace_period_days: bodyGracePeriod,
      penalty_percent: bodyPenaltyPercent,
    } = body;

    if (!course_id || !Array.isArray(student_ids) || student_ids.length === 0) {
      return NextResponse.json(
        {
          error: "course_id y student_ids (array no vacío) son obligatorios",
        },
        { status: 400 }
      );
    }

    const uniqueStudentIds = [...new Set(student_ids as string[])];

    // 1) Get course from courses table
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("id, profile_id, academy_id, mensualidad")
      .eq("id", course_id)
      .is("deleted_at", null)
      .single();

    if (courseErr || !course) {
      return NextResponse.json(
        { error: "Curso no encontrado" },
        { status: 404 }
      );
    }

    const profileId = course.profile_id;
    const mensualidad = course.mensualidad;

    if (mensualidad == null || Number(mensualidad) <= 0) {
      return NextResponse.json(
        {
          error:
            "El curso no tiene mensualidad definida. Define la mensualidad en el curso antes de generar contratos.",
        },
        { status: 400 }
      );
    }

    const monthlyAmount = Number(mensualidad);

    const effectiveAcademyId = course.academy_id;
    if (
      profile.role !== "super_admin" &&
      effectiveAcademyId !== academyId
    ) {
      return NextResponse.json(
        { error: "El curso no pertenece a tu academia" },
        { status: 403 }
      );
    }

    // 2) Get session date range from course_sessions
    const { data: dates } = await supabaseAdmin
      .from("course_sessions")
      .select("date")
      .eq("course_id", course_id)
      .order("date", { ascending: true });

    const dateList = (dates || []) as { date: string }[];
    const start_date =
      dateList.length > 0 ? dateList[0].date : null;
    const end_date =
      dateList.length > 0 ? dateList[dateList.length - 1].date : null;

    if (!start_date || !end_date) {
      return NextResponse.json(
        {
          error:
            "El curso no tiene fechas de sesiones. No se puede generar el contrato.",
        },
        { status: 400 }
      );
    }

    const validGracePeriods = [3, 5, 7, 15];
    const validPenaltyPercents = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const defaultBillingDay =
      typeof bodyBillingDay === "number" && bodyBillingDay >= 1 && bodyBillingDay <= 31
        ? Math.min(31, Math.max(1, Math.floor(bodyBillingDay)))
        : (() => {
            const d = new Date(start_date + "T12:00:00");
            const day = d.getDate();
            return day >= 1 && day <= 31 ? day : 1;
          })();
    const grace_period_days = validGracePeriods.includes(Number(bodyGracePeriod))
      ? Number(bodyGracePeriod)
      : 5;
    const penalty_percent = validPenaltyPercents.includes(Number(bodyPenaltyPercent))
      ? Number(bodyPenaltyPercent)
      : 20;

    // 3) Validate students
    const { data: students, error: studentsErr } = await supabaseAdmin
      .from("students")
      .select("id, academy_id, enrollment_status, deleted_at")
      .in("id", uniqueStudentIds)
      .is("deleted_at", null);

    if (
      studentsErr ||
      !students ||
      students.length !== uniqueStudentIds.length
    ) {
      return NextResponse.json(
        {
          error:
            "Uno o más estudiantes no fueron encontrados o están inactivos",
        },
        { status: 400 }
      );
    }

    for (const s of students) {
      if (s.academy_id !== effectiveAcademyId) {
        return NextResponse.json(
          { error: `El estudiante no pertenece a esta academia` },
          { status: 400 }
        );
      }
      if (s.enrollment_status === "retirado") {
        return NextResponse.json(
          { error: "Uno o más estudiantes tienen estado retirado" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate enrollments
    const { data: existingRegs } = await supabaseAdmin
      .from("course_registrations")
      .select("id, student_id")
      .eq("course_id", course_id)
      .in("student_id", uniqueStudentIds)
      .is("deleted_at", null);

    const alreadyEnrolled = (existingRegs || []).map(
      (r: { student_id: string }) => r.student_id
    );
    if (alreadyEnrolled.length > 0) {
      return NextResponse.json(
        {
          error: "Uno o más estudiantes ya están matriculados en este curso",
          details: `Estudiantes ya matriculados: ${alreadyEnrolled.length}`,
        },
        { status: 400 }
      );
    }

    // 4) Get guardian for each student
    const { data: guardianAssignments } = await supabaseAdmin
      .from("guardian_students")
      .select("student_id, guardian_id")
      .in("student_id", uniqueStudentIds);

    const studentToGuardian: Record<string, string> = {};
    for (const gs of guardianAssignments || []) {
      studentToGuardian[(gs as { student_id: string }).student_id] = (
        gs as { guardian_id: string }
      ).guardian_id;
    }

    const studentsWithoutGuardian = uniqueStudentIds.filter(
      (id) => !studentToGuardian[id]
    );
    if (studentsWithoutGuardian.length > 0) {
      return NextResponse.json(
        {
          error:
            "Uno o más estudiantes no tienen encargado asignado. Asigna un encargado antes de generar contratos.",
        },
        { status: 400 }
      );
    }

    // 5) Create course_registrations (using course_id)
    const enrollmentDate = new Date().toISOString().split("T")[0];
    const regInserts = uniqueStudentIds.map((studentId) => ({
      academy_id: effectiveAcademyId,
      student_id: studentId,
      course_id: course_id,
      profile_id: profileId,
      status: "active",
      enrollment_date: enrollmentDate,
    }));

    const { data: newRegs, error: regErr } = await supabaseAdmin
      .from("course_registrations")
      .insert(regInserts)
      .select("id, student_id");

    if (regErr || !newRegs || newRegs.length !== uniqueStudentIds.length) {
      console.error("Error creating course registrations:", regErr);
      const errMsg = (regErr as { message?: string; code?: string })?.message ?? "";
      const errCode = (regErr as { code?: string })?.code;
      const hint =
        errCode === "23502"
          ? " Es posible que falten migraciones. Ejecuta: npx supabase db push"
          : "";
      return NextResponse.json(
        {
          error: "Error al crear las matrículas",
          details: errMsg + hint,
        },
        { status: 500 }
      );
    }

    // 6) Group registrations by guardian and create contracts
    const byGuardian: Record<string, string[]> = {};
    for (const reg of newRegs) {
      const gid = studentToGuardian[reg.student_id];
      if (!byGuardian[gid]) byGuardian[gid] = [];
      byGuardian[gid].push(reg.id);
    }

    const createdContracts: {
      id: string;
      guardian_id: string;
      monthly_amount: number;
      course_registration_ids: string[];
    }[] = [];

    for (const [guardianId, crIds] of Object.entries(byGuardian)) {
      const guardianMonthlyAmount = crIds.length * monthlyAmount;

      const { data: contract, error: contractErr } = await supabaseAdmin
        .from("contracts")
        .insert({
          academy_id: effectiveAcademyId,
          guardian_id: guardianId,
          monthly_amount: guardianMonthlyAmount,
          start_date: start_date,
          end_date: end_date,
          billing_day: defaultBillingDay,
          grace_period_days,
          penalty_percent,
        })
        .select()
        .single();

      if (contractErr) {
        console.error("Error creating contract:", contractErr);
        await supabaseAdmin
          .from("course_registrations")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", newRegs.map((r) => r.id));
        return NextResponse.json(
          {
            error: "Error al crear el contrato",
            details: contractErr.message,
          },
          { status: 500 }
        );
      }

      const ccrInserts = crIds.map((crId) => ({
        contract_id: contract.id,
        course_registration_id: crId,
      }));

      const { error: ccrErr } = await supabaseAdmin
        .from("contract_course_registrations")
        .insert(ccrInserts);

      if (ccrErr) {
        console.error("Error creating contract_course_registrations:", ccrErr);
        await supabaseAdmin.from("contracts").delete().eq("id", contract.id);
        await supabaseAdmin
          .from("course_registrations")
          .update({ deleted_at: new Date().toISOString() })
          .in("id", newRegs.map((r) => r.id));
        return NextResponse.json(
          {
            error: "Error al vincular matrículas al contrato",
            details: ccrErr.message,
          },
          { status: 500 }
        );
      }

      const invoices: {
        contract_id: string;
        month: string;
        amount: number;
        status: string;
      }[] = [];
      for (const d of billingPeriodStarts(start_date, end_date, 1)) {
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        invoices.push({
          contract_id: contract.id,
          month: monthStr,
          amount: guardianMonthlyAmount,
          status: "pendiente",
        });
      }

      if (invoices.length > 0) {
        const { error: invErr } = await supabaseAdmin
          .from("contract_invoices")
          .insert(invoices);

        if (invErr) {
          console.error("Error creating invoices:", invErr);
          await supabaseAdmin
            .from("contract_course_registrations")
            .delete()
            .eq("contract_id", contract.id);
          await supabaseAdmin.from("contracts").delete().eq("id", contract.id);
          await supabaseAdmin
            .from("course_registrations")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", newRegs.map((r) => r.id));
          return NextResponse.json(
            {
              error: "Error al crear facturas",
              details: invErr.message,
            },
            { status: 500 }
          );
        }
      }

      createdContracts.push({
        id: contract.id,
        guardian_id: guardianId,
        monthly_amount: guardianMonthlyAmount,
        course_registration_ids: crIds,
      });
    }

    return NextResponse.json({
      registrations: newRegs,
      contracts: createdContracts,
    });
  } catch (error) {
    console.error(
      "Unexpected error in POST /api/course-registrations/bulk-with-contracts:",
      error
    );
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
