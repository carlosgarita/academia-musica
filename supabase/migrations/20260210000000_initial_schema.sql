


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_schedule_conflicts"("p_academy_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_schedule_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
declare
  conflict_exists boolean;
begin
  select exists(
    select 1
    from public.schedules s
    where s.academy_id = p_academy_id
      and s.day_of_week = p_day_of_week
      and s.id != coalesce(p_schedule_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        (s.start_time <= p_start_time and s.end_time > p_start_time)
        or (s.start_time < p_end_time and s.end_time >= p_end_time)
        or (s.start_time >= p_start_time and s.end_time <= p_end_time)
      )
  ) into conflict_exists;
  
  return not conflict_exists;
end;
$$;


ALTER FUNCTION "public"."check_schedule_conflicts"("p_academy_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_schedule_conflicts"("p_professor_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_academy_id" "uuid", "p_schedule_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("conflict_type" "text", "conflict_message" "text", "conflicting_schedule_id" "uuid", "conflicting_schedule_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_conflict record;
begin
  -- Check for professor conflicts (same professor, same day, overlapping time)
  for v_conflict in
    select 
      s.id,
      s.name,
      'professor' as conflict_type,
      'El profesor ya tiene una clase asignada en este horario' as message
    from public.schedules s
    where s.professor_id = p_professor_id
      and s.day_of_week = p_day_of_week
      and s.academy_id = p_academy_id
      and (p_schedule_id is null or s.id != p_schedule_id) -- exclude current schedule if updating
      and (
        -- Time overlap: start or end is within the other schedule, or completely contains it
        (p_start_time >= s.start_time and p_start_time < s.end_time) or
        (p_end_time > s.start_time and p_end_time <= s.end_time) or
        (p_start_time <= s.start_time and p_end_time >= s.end_time)
      )
  loop
    return query select 
      v_conflict.conflict_type::text,
      v_conflict.message::text,
      v_conflict.id,
      v_conflict.name::text;
  end loop;

  -- Check for student conflicts (students already enrolled in overlapping schedules)
  -- This will be called separately when assigning students
  -- For now, we return empty if no professor conflicts
  return;
end;
$$;


ALTER FUNCTION "public"."check_schedule_conflicts"("p_professor_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_academy_id" "uuid", "p_schedule_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_default_evaluation_data"("academy_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insertar rubros predeterminados
  INSERT INTO public.evaluation_rubrics (academy_id, name, description, is_default, display_order)
  VALUES
    (academy_uuid, 'Digitación', 'Evaluación de la técnica de digitación', true, 1),
    (academy_uuid, 'Coordinación', 'Evaluación de la coordinación entre manos', true, 2),
    (academy_uuid, 'Lectura Rítmica', 'Evaluación de la lectura rítmica', true, 3),
    (academy_uuid, 'Lectura Melódica', 'Evaluación de la lectura melódica', true, 4)
  ON CONFLICT DO NOTHING;

  -- Insertar escala predeterminada
  INSERT INTO public.evaluation_scales (academy_id, name, description, numeric_value, is_default, display_order)
  VALUES
    (academy_uuid, 'Completamente Satisfactorio', 'El estudiante ha cumplido completamente con el objetivo', 3, true, 1),
    (academy_uuid, 'En Progreso', 'El estudiante está avanzando pero aún no cumple completamente', 2, true, 2),
    (academy_uuid, 'No resuelto por falta de comprensión', 'El estudiante no ha comprendido el concepto', 1, true, 3),
    (academy_uuid, 'No resuelto por falta de estudio', 'El estudiante no ha estudiado lo suficiente', 0, true, 4)
  ON CONFLICT DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."insert_default_evaluation_data"("academy_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_insert_default_evaluation_data"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM public.insert_default_evaluation_data(NEW.id);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_insert_default_evaluation_data"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."academies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "logo_url" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "address" "text",
    "phone" "text",
    "website" "text",
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "academies_address_length_check" CHECK ((("address" IS NULL) OR ("char_length"("address") <= 200))),
    CONSTRAINT "academies_name_length_check" CHECK (("char_length"("name") <= 100)),
    CONSTRAINT "academies_phone_length_check" CHECK ((("phone" IS NULL) OR ("char_length"("phone") <= 20))),
    CONSTRAINT "academies_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"]))),
    CONSTRAINT "academies_website_length_check" CHECK ((("website" IS NULL) OR ("char_length"("website") <= 200)))
);


ALTER TABLE "public"."academies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "changed_by" "uuid",
    "old_value" "text",
    "new_value" "text",
    "change_type" "text",
    "related_student_id" "uuid",
    "related_session_id" "uuid",
    CONSTRAINT "audit_logs_action_check" CHECK (("char_length"("action") <= 50)),
    CONSTRAINT "audit_logs_change_type_check" CHECK (("char_length"("change_type") <= 50)),
    CONSTRAINT "audit_logs_table_name_check" CHECK (("char_length"("table_name") <= 100))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "virtud" "text",
    "frase" "text",
    CONSTRAINT "badges_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "badges_frase_check" CHECK (("char_length"("frase") <= 500)),
    CONSTRAINT "badges_image_url_check" CHECK (("char_length"("image_url") <= 500)),
    CONSTRAINT "badges_name_check" CHECK (("char_length"("name") <= 100)),
    CONSTRAINT "badges_virtud_check" CHECK (("char_length"("virtud") <= 100))
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contract_course_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."contract_course_registrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."contract_course_registrations" IS 'Links contracts to specific student course enrollments being charged';



CREATE TABLE IF NOT EXISTS "public"."contract_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "month" "date" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "contract_invoices_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "contract_invoices_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'pagado'::"text"])))
);


ALTER TABLE "public"."contract_invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."contract_invoices" IS 'Monthly invoices for contracts; atrasado computed in UI when pendiente + month passed';



CREATE TABLE IF NOT EXISTS "public"."contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "monthly_amount" numeric(12,2) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "billing_frequency" "text" DEFAULT 'mensual'::"text" NOT NULL,
    CONSTRAINT "contracts_billing_frequency_check" CHECK (("billing_frequency" = ANY (ARRAY['mensual'::"text", 'bimestral'::"text", 'trimestral'::"text", 'cuatrimestral'::"text", 'semestral'::"text"]))),
    CONSTRAINT "contracts_check" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "contracts_monthly_amount_check" CHECK (("monthly_amount" >= (0)::numeric))
);


ALTER TABLE "public"."contracts" OWNER TO "postgres";


COMMENT ON TABLE "public"."contracts" IS 'Financial contracts between academy and guardians for course enrollments';



COMMENT ON COLUMN "public"."contracts"."billing_frequency" IS 'Frecuencia de facturación: mensual, bimestral, trimestral, cuatrimestral o semestral';



CREATE TABLE IF NOT EXISTS "public"."course_registration_songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."course_registration_songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "enrollment_date" "date" DEFAULT CURRENT_DATE,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "profile_id" "uuid",
    "course_id" "uuid",
    CONSTRAINT "course_registrations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."course_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."course_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."course_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "mensualidad" numeric(12,2),
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "courses_mensualidad_check" CHECK (("mensualidad" >= (0)::numeric)),
    CONSTRAINT "courses_name_check" CHECK (("char_length"("name") <= 200)),
    CONSTRAINT "courses_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_rubrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "evaluation_rubrics_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "evaluation_rubrics_name_check" CHECK (("char_length"("name") <= 100))
);


ALTER TABLE "public"."evaluation_rubrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluation_scales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "numeric_value" integer NOT NULL,
    "is_default" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "evaluation_scales_description_check" CHECK (("char_length"("description") <= 500)),
    CONSTRAINT "evaluation_scales_name_check" CHECK (("char_length"("name") <= 100))
);


ALTER TABLE "public"."evaluation_scales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guardian_students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guardian_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "relationship" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "guardian_students_relationship_check" CHECK (("char_length"("relationship") <= 50))
);


ALTER TABLE "public"."guardian_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "academy_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "additional_info" "text",
    "deleted_at" timestamp with time zone,
    CONSTRAINT "profiles_additional_info_check" CHECK (("char_length"("additional_info") <= 500)),
    CONSTRAINT "profiles_email_length_check" CHECK (("char_length"("email") <= 255)),
    CONSTRAINT "profiles_first_name_length_check" CHECK ((("first_name" IS NULL) OR ("char_length"("first_name") <= 50))),
    CONSTRAINT "profiles_last_name_length_check" CHECK ((("last_name" IS NULL) OR ("char_length"("last_name") <= 50))),
    CONSTRAINT "profiles_phone_length_check" CHECK ((("phone" IS NULL) OR ("char_length"("phone") <= 20))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'director'::"text", 'professor'::"text", 'student'::"text", 'guardian'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone,
    "course_id" "uuid",
    CONSTRAINT "schedules_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 7))),
    CONSTRAINT "schedules_name_check" CHECK (("char_length"("name") <= 100)),
    CONSTRAINT "schedules_time_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "schedules_time_range_check" CHECK ((("start_time" >= '07:00:00'::time without time zone) AND ("end_time" <= '22:00:00'::time without time zone)))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "assignment_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "course_session_id" "uuid",
    CONSTRAINT "session_assignments_assignment_text_check" CHECK (("char_length"("assignment_text") <= 1500))
);


ALTER TABLE "public"."session_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_attendances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "attendance_status" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "course_session_id" "uuid",
    CONSTRAINT "session_attendances_attendance_status_check" CHECK (("attendance_status" = ANY (ARRAY['presente'::"text", 'ausente'::"text", 'tardanza'::"text", 'justificado'::"text"]))),
    CONSTRAINT "session_attendances_notes_check" CHECK (("char_length"("notes") <= 500))
);


ALTER TABLE "public"."session_attendances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "comment" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "course_session_id" "uuid",
    CONSTRAINT "session_comments_comment_check" CHECK (("char_length"("comment") <= 1500))
);


ALTER TABLE "public"."session_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."session_group_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "course_session_id" "uuid",
    CONSTRAINT "session_group_assignments_assignment_text_check" CHECK (("char_length"("assignment_text") <= 1500))
);


ALTER TABLE "public"."session_group_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."song_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "song_id" "uuid" NOT NULL,
    "rubric_id" "uuid" NOT NULL,
    "scale_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "course_session_id" "uuid"
);


ALTER TABLE "public"."song_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."songs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "author" "text",
    "difficulty_level" integer NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "songs_author_check" CHECK (("char_length"("author") <= 200)),
    CONSTRAINT "songs_difficulty_level_check" CHECK ((("difficulty_level" >= 1) AND ("difficulty_level" <= 5))),
    CONSTRAINT "songs_name_check" CHECK (("char_length"("name") <= 200))
);


ALTER TABLE "public"."songs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "course_registration_id" "uuid" NOT NULL,
    "badge_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "student_badges_notes_check" CHECK (("char_length"("notes") <= 500))
);


ALTER TABLE "public"."student_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "academy_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "date_of_birth" "date",
    "enrollment_status" "text" DEFAULT 'inscrito'::"text",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "additional_info" "text",
    "deleted_at" timestamp with time zone,
    "is_self_guardian" boolean DEFAULT false NOT NULL,
    CONSTRAINT "students_additional_info_check" CHECK (("char_length"("additional_info") <= 500)),
    CONSTRAINT "students_enrollment_status_check" CHECK (("enrollment_status" = ANY (ARRAY['inscrito'::"text", 'retirado'::"text", 'graduado'::"text"]))),
    CONSTRAINT "students_first_name_check" CHECK (("char_length"("first_name") <= 50)),
    CONSTRAINT "students_last_name_check" CHECK (("char_length"("last_name") <= 50))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


COMMENT ON COLUMN "public"."students"."is_self_guardian" IS 'True when the student is an adult and their own guardian (mayor de edad, a cargo de sí mismo)';



CREATE TABLE IF NOT EXISTS "public"."task_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_assignment_id" "uuid",
    "session_group_assignment_id" "uuid",
    "student_id" "uuid" NOT NULL,
    "completed_by" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_completions_exactly_one_assignment" CHECK (((("session_assignment_id" IS NOT NULL) AND ("session_group_assignment_id" IS NULL)) OR (("session_assignment_id" IS NULL) AND ("session_group_assignment_id" IS NOT NULL))))
);


ALTER TABLE "public"."task_completions" OWNER TO "postgres";


COMMENT ON TABLE "public"."task_completions" IS 'Records when guardians mark tasks as completed for their students';



ALTER TABLE ONLY "public"."academies"
    ADD CONSTRAINT "academies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_course_registrations"
    ADD CONSTRAINT "contract_course_registrations_contract_id_course_registrati_key" UNIQUE ("contract_id", "course_registration_id");



ALTER TABLE ONLY "public"."contract_course_registrations"
    ADD CONSTRAINT "contract_course_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_invoices"
    ADD CONSTRAINT "contract_invoices_contract_id_month_key" UNIQUE ("contract_id", "month");



ALTER TABLE ONLY "public"."contract_invoices"
    ADD CONSTRAINT "contract_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_course_registration_id_song_id_key" UNIQUE ("course_registration_id", "song_id");



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_sessions"
    ADD CONSTRAINT "course_sessions_course_id_date_key" UNIQUE ("course_id", "date");



ALTER TABLE ONLY "public"."course_sessions"
    ADD CONSTRAINT "course_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_rubrics"
    ADD CONSTRAINT "evaluation_rubrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluation_scales"
    ADD CONSTRAINT "evaluation_scales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_guardian_id_student_id_key" UNIQUE ("guardian_id", "student_id");



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_assignments"
    ADD CONSTRAINT "session_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_attendances"
    ADD CONSTRAINT "session_attendances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_comments"
    ADD CONSTRAINT "session_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."session_group_assignments"
    ADD CONSTRAINT "session_group_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."song_evaluations"
    ADD CONSTRAINT "song_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_course_registration_id_badge_id_key" UNIQUE ("course_registration_id", "badge_id");



ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_unique_group" UNIQUE ("session_group_assignment_id", "student_id");



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_unique_individual" UNIQUE ("session_assignment_id", "student_id");



CREATE INDEX "idx_audit_logs_change_type" ON "public"."audit_logs" USING "btree" ("change_type");



CREATE INDEX "idx_audit_logs_changed_by" ON "public"."audit_logs" USING "btree" ("changed_by");



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_related_session" ON "public"."audit_logs" USING "btree" ("related_session_id");



CREATE INDEX "idx_audit_logs_related_student" ON "public"."audit_logs" USING "btree" ("related_student_id");



CREATE INDEX "idx_audit_logs_table_record" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_badges_academy_id" ON "public"."badges" USING "btree" ("academy_id");



CREATE INDEX "idx_contract_course_registrations_contract" ON "public"."contract_course_registrations" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_course_registrations_registration" ON "public"."contract_course_registrations" USING "btree" ("course_registration_id");



CREATE INDEX "idx_contract_invoices_contract" ON "public"."contract_invoices" USING "btree" ("contract_id");



CREATE INDEX "idx_contract_invoices_month" ON "public"."contract_invoices" USING "btree" ("month");



CREATE INDEX "idx_contracts_academy" ON "public"."contracts" USING "btree" ("academy_id");



CREATE INDEX "idx_contracts_dates" ON "public"."contracts" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_contracts_guardian" ON "public"."contracts" USING "btree" ("guardian_id");



CREATE INDEX "idx_course_registration_songs_registration" ON "public"."course_registration_songs" USING "btree" ("course_registration_id");



CREATE INDEX "idx_course_registration_songs_song" ON "public"."course_registration_songs" USING "btree" ("song_id");



CREATE INDEX "idx_course_registrations_academy_id" ON "public"."course_registrations" USING "btree" ("academy_id");



CREATE INDEX "idx_course_registrations_course_id" ON "public"."course_registrations" USING "btree" ("course_id") WHERE ("course_id" IS NOT NULL);



CREATE INDEX "idx_course_registrations_profile_id" ON "public"."course_registrations" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_course_registrations_student_id" ON "public"."course_registrations" USING "btree" ("student_id");



CREATE INDEX "idx_course_sessions_course_id" ON "public"."course_sessions" USING "btree" ("course_id");



CREATE INDEX "idx_course_sessions_date" ON "public"."course_sessions" USING "btree" ("date");



CREATE INDEX "idx_courses_academy_id" ON "public"."courses" USING "btree" ("academy_id");



CREATE INDEX "idx_courses_profile_id" ON "public"."courses" USING "btree" ("profile_id");



CREATE INDEX "idx_courses_year" ON "public"."courses" USING "btree" ("year");



CREATE INDEX "idx_evaluation_rubrics_academy_id" ON "public"."evaluation_rubrics" USING "btree" ("academy_id");



CREATE INDEX "idx_evaluation_rubrics_display_order" ON "public"."evaluation_rubrics" USING "btree" ("display_order");



CREATE INDEX "idx_evaluation_scales_academy_id" ON "public"."evaluation_scales" USING "btree" ("academy_id");



CREATE INDEX "idx_evaluation_scales_display_order" ON "public"."evaluation_scales" USING "btree" ("display_order");



CREATE INDEX "idx_evaluation_scales_numeric_value" ON "public"."evaluation_scales" USING "btree" ("numeric_value");



CREATE INDEX "idx_guardian_students_academy" ON "public"."guardian_students" USING "btree" ("academy_id");



CREATE INDEX "idx_guardian_students_guardian" ON "public"."guardian_students" USING "btree" ("guardian_id");



CREATE INDEX "idx_guardian_students_student" ON "public"."guardian_students" USING "btree" ("student_id");



CREATE INDEX "idx_schedules_academy" ON "public"."schedules" USING "btree" ("academy_id");



CREATE INDEX "idx_schedules_course_id" ON "public"."schedules" USING "btree" ("course_id") WHERE ("course_id" IS NOT NULL);



CREATE INDEX "idx_schedules_profile_day_time" ON "public"."schedules" USING "btree" ("profile_id", "day_of_week", "start_time", "end_time");



CREATE INDEX "idx_session_assignments_course_registration" ON "public"."session_assignments" USING "btree" ("course_registration_id");



CREATE INDEX "idx_session_assignments_course_session" ON "public"."session_assignments" USING "btree" ("course_session_id") WHERE ("course_session_id" IS NOT NULL);



CREATE INDEX "idx_session_attendances_course_registration" ON "public"."session_attendances" USING "btree" ("course_registration_id");



CREATE INDEX "idx_session_attendances_course_session" ON "public"."session_attendances" USING "btree" ("course_session_id") WHERE ("course_session_id" IS NOT NULL);



CREATE INDEX "idx_session_attendances_status" ON "public"."session_attendances" USING "btree" ("attendance_status");



CREATE INDEX "idx_session_comments_course_registration" ON "public"."session_comments" USING "btree" ("course_registration_id");



CREATE INDEX "idx_session_comments_course_session" ON "public"."session_comments" USING "btree" ("course_session_id") WHERE ("course_session_id" IS NOT NULL);



CREATE INDEX "idx_session_group_assignments_course_session" ON "public"."session_group_assignments" USING "btree" ("course_session_id") WHERE ("course_session_id" IS NOT NULL);



CREATE INDEX "idx_song_evaluations_course_registration" ON "public"."song_evaluations" USING "btree" ("course_registration_id");



CREATE INDEX "idx_song_evaluations_course_session" ON "public"."song_evaluations" USING "btree" ("course_session_id") WHERE ("course_session_id" IS NOT NULL);



CREATE INDEX "idx_song_evaluations_created_at" ON "public"."song_evaluations" USING "btree" ("created_at");



CREATE INDEX "idx_song_evaluations_rubric" ON "public"."song_evaluations" USING "btree" ("rubric_id");



CREATE INDEX "idx_song_evaluations_song" ON "public"."song_evaluations" USING "btree" ("song_id");



CREATE UNIQUE INDEX "idx_song_evaluations_unique_session" ON "public"."song_evaluations" USING "btree" ("course_registration_id", "song_id", "course_session_id", "rubric_id") WHERE ("course_session_id" IS NOT NULL);



CREATE INDEX "idx_songs_academy_id" ON "public"."songs" USING "btree" ("academy_id");



CREATE INDEX "idx_songs_difficulty_level" ON "public"."songs" USING "btree" ("difficulty_level");



CREATE INDEX "idx_student_badges_assigned_by" ON "public"."student_badges" USING "btree" ("assigned_by");



CREATE INDEX "idx_student_badges_badge" ON "public"."student_badges" USING "btree" ("badge_id");



CREATE INDEX "idx_student_badges_course_registration" ON "public"."student_badges" USING "btree" ("course_registration_id");



CREATE INDEX "idx_task_completions_completed_by" ON "public"."task_completions" USING "btree" ("completed_by");



CREATE INDEX "idx_task_completions_session_assignment" ON "public"."task_completions" USING "btree" ("session_assignment_id") WHERE ("session_assignment_id" IS NOT NULL);



CREATE INDEX "idx_task_completions_session_group_assignment" ON "public"."task_completions" USING "btree" ("session_group_assignment_id") WHERE ("session_group_assignment_id" IS NOT NULL);



CREATE INDEX "idx_task_completions_student_id" ON "public"."task_completions" USING "btree" ("student_id");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."academies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."badges" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."contract_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."contracts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."course_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."courses" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."evaluation_rubrics" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."evaluation_scales" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."guardian_students" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."session_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."session_attendances" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."session_comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."session_group_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."song_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."songs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_academy_default_evaluation_data" AFTER INSERT ON "public"."academies" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_insert_default_evaluation_data"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_related_student_id_fkey" FOREIGN KEY ("related_student_id") REFERENCES "public"."students"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_course_registrations"
    ADD CONSTRAINT "contract_course_registrations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_course_registrations"
    ADD CONSTRAINT "contract_course_registrations_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_invoices"
    ADD CONSTRAINT "contract_invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contracts"
    ADD CONSTRAINT "contracts_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_sessions"
    ADD CONSTRAINT "course_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluation_rubrics"
    ADD CONSTRAINT "evaluation_rubrics_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluation_scales"
    ADD CONSTRAINT "evaluation_scales_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_assignments"
    ADD CONSTRAINT "session_assignments_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_assignments"
    ADD CONSTRAINT "session_assignments_course_session_id_fkey" FOREIGN KEY ("course_session_id") REFERENCES "public"."course_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendances"
    ADD CONSTRAINT "session_attendances_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_attendances"
    ADD CONSTRAINT "session_attendances_course_session_id_fkey" FOREIGN KEY ("course_session_id") REFERENCES "public"."course_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_comments"
    ADD CONSTRAINT "session_comments_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_comments"
    ADD CONSTRAINT "session_comments_course_session_id_fkey" FOREIGN KEY ("course_session_id") REFERENCES "public"."course_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."session_group_assignments"
    ADD CONSTRAINT "session_group_assignments_course_session_id_fkey" FOREIGN KEY ("course_session_id") REFERENCES "public"."course_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_evaluations"
    ADD CONSTRAINT "song_evaluations_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_evaluations"
    ADD CONSTRAINT "song_evaluations_course_session_id_fkey" FOREIGN KEY ("course_session_id") REFERENCES "public"."course_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_evaluations"
    ADD CONSTRAINT "song_evaluations_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."evaluation_rubrics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."song_evaluations"
    ADD CONSTRAINT "song_evaluations_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "public"."evaluation_scales"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."song_evaluations"
    ADD CONSTRAINT "song_evaluations_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_session_assignment_id_fkey" FOREIGN KEY ("session_assignment_id") REFERENCES "public"."session_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_session_group_assignment_id_fkey" FOREIGN KEY ("session_group_assignment_id") REFERENCES "public"."session_group_assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_completions"
    ADD CONSTRAINT "task_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



CREATE POLICY "Directors can manage badges in their academy" ON "public"."badges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "badges"."academy_id")))));



CREATE POLICY "Directors can manage contract_course_registrations" ON "public"."contract_course_registrations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."contracts" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "contract_course_registrations"."contract_id") AND ("p"."role" = ANY (ARRAY['director'::"text", 'super_admin'::"text"])) AND (("p"."role" = 'super_admin'::"text") OR ("p"."academy_id" = "c"."academy_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."contracts" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "contract_course_registrations"."contract_id") AND ("p"."role" = ANY (ARRAY['director'::"text", 'super_admin'::"text"])) AND (("p"."role" = 'super_admin'::"text") OR ("p"."academy_id" = "c"."academy_id"))))));



CREATE POLICY "Directors can manage contract_invoices" ON "public"."contract_invoices" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."contracts" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "contract_invoices"."contract_id") AND ("p"."role" = ANY (ARRAY['director'::"text", 'super_admin'::"text"])) AND (("p"."role" = 'super_admin'::"text") OR ("p"."academy_id" = "c"."academy_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."contracts" "c"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("c"."id" = "contract_invoices"."contract_id") AND ("p"."role" = ANY (ARRAY['director'::"text", 'super_admin'::"text"])) AND (("p"."role" = 'super_admin'::"text") OR ("p"."academy_id" = "c"."academy_id"))))));



CREATE POLICY "Directors can manage contracts in their academy" ON "public"."contracts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['director'::"text", 'super_admin'::"text"])) AND (("p"."role" = 'super_admin'::"text") OR ("p"."academy_id" = "contracts"."academy_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['director'::"text", 'super_admin'::"text"])) AND (("p"."role" = 'super_admin'::"text") OR ("p"."academy_id" = "contracts"."academy_id"))))));



CREATE POLICY "Directors can manage course_registration_songs" ON "public"."course_registration_songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id")))));



CREATE POLICY "Directors can manage course_registrations in their academy" ON "public"."course_registrations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id")))));



CREATE POLICY "Directors can manage course_sessions in their academy" ON "public"."course_sessions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."courses" "c"
     JOIN "public"."profiles" "p" ON (("p"."academy_id" = "c"."academy_id")))
  WHERE (("c"."id" = "course_sessions"."course_id") AND ("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."courses" "c"
     JOIN "public"."profiles" "p" ON (("p"."academy_id" = "c"."academy_id")))
  WHERE (("c"."id" = "course_sessions"."course_id") AND ("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage courses in their academy" ON "public"."courses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "courses"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "courses"."academy_id")))));



CREATE POLICY "Directors can manage evaluation_rubrics in their academy" ON "public"."evaluation_rubrics" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "evaluation_rubrics"."academy_id")))));



CREATE POLICY "Directors can manage evaluation_scales in their academy" ON "public"."evaluation_scales" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "evaluation_scales"."academy_id")))));



CREATE POLICY "Directors can manage guardian_students in their academy" ON "public"."guardian_students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "guardian_students"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage schedules in their academy" ON "public"."schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "schedules"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage session_assignments in their academy" ON "public"."session_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_assignments"."course_registration_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "cr"."academy_id")))));



CREATE POLICY "Directors can manage session_attendances in their academy" ON "public"."session_attendances" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_attendances"."course_registration_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "cr"."academy_id")))));



CREATE POLICY "Directors can manage session_comments in their academy" ON "public"."session_comments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_comments"."course_registration_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "cr"."academy_id")))));



CREATE POLICY "Directors can manage session_group_assignments in their academy" ON "public"."session_group_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "p"
     JOIN "public"."course_sessions" "cs" ON (("cs"."id" = "session_group_assignments"."course_session_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "cs"."course_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "c"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."profiles" "p"
     JOIN "public"."course_sessions" "cs" ON (("cs"."id" = "session_group_assignments"."course_session_id")))
     JOIN "public"."courses" "c" ON (("c"."id" = "cs"."course_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "c"."academy_id")))));



CREATE POLICY "Directors can manage song_evaluations in their academy" ON "public"."song_evaluations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "song_evaluations"."course_registration_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "cr"."academy_id")))));



CREATE POLICY "Directors can manage songs in their academy" ON "public"."songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "songs"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Directors can manage student_badges in their academy" ON "public"."student_badges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "student_badges"."course_registration_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "cr"."academy_id")))));



CREATE POLICY "Directors can manage students in their academy" ON "public"."students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "students"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can view their own academy" ON "public"."academies" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "academies"."id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Guardians can view badges in their children's academy" ON "public"."badges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."students" "s" ON (("s"."id" = "gs"."student_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("s"."academy_id" = "badges"."academy_id")))));



CREATE POLICY "Guardians can view course_registration_songs for their children" ON "public"."course_registration_songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("guardian_students"."guardian_id" = "auth"."uid"()) AND ("guardian_students"."student_id" = "course_registrations"."student_id")))));



CREATE POLICY "Guardians can view course_registrations for their children" ON "public"."course_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."guardian_students"
  WHERE (("guardian_students"."guardian_id" = "auth"."uid"()) AND ("guardian_students"."student_id" = "course_registrations"."student_id")))));



CREATE POLICY "Guardians can view course_sessions" ON "public"."course_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."student_id" = "gs"."student_id")))
  WHERE (("cr"."course_id" = "course_sessions"."course_id") AND ("gs"."guardian_id" = "auth"."uid"())))));



CREATE POLICY "Guardians can view courses in their children academy" ON "public"."courses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."students" "s" ON (("s"."id" = "gs"."student_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("s"."academy_id" = "courses"."academy_id")))));



CREATE POLICY "Guardians can view session_assignments for their children" ON "public"."session_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_assignments"."course_registration_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("gs"."student_id" = "cr"."student_id")))));



CREATE POLICY "Guardians can view session_attendances for their children" ON "public"."session_attendances" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_attendances"."course_registration_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("gs"."student_id" = "cr"."student_id")))));



CREATE POLICY "Guardians can view session_comments for their children" ON "public"."session_comments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_comments"."course_registration_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("gs"."student_id" = "cr"."student_id")))));



CREATE POLICY "Guardians can view session_group_assignments for their children" ON "public"."session_group_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."student_id" = "gs"."student_id")))
     JOIN "public"."course_sessions" "cs" ON (("cs"."course_id" = "cr"."course_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("cs"."id" = "session_group_assignments"."course_session_id")))));



CREATE POLICY "Guardians can view song_evaluations for their children" ON "public"."song_evaluations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "song_evaluations"."course_registration_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("gs"."student_id" = "cr"."student_id")))));



CREATE POLICY "Guardians can view songs in their children's academy" ON "public"."songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles"
     JOIN "public"."guardian_students" ON (("guardian_students"."guardian_id" = "profiles"."id")))
     JOIN "public"."students" ON (("students"."id" = "guardian_students"."student_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'guardian'::"text") AND ("students"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Guardians can view student_badges for their children" ON "public"."student_badges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students" "gs"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "student_badges"."course_registration_id")))
  WHERE (("gs"."guardian_id" = "auth"."uid"()) AND ("gs"."student_id" = "cr"."student_id")))));



CREATE POLICY "Guardians can view their assigned students" ON "public"."students" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."guardian_students"
  WHERE (("guardian_students"."guardian_id" = "auth"."uid"()) AND ("guardian_students"."student_id" = "students"."id")))));



CREATE POLICY "Guardians can view their own student assignments" ON "public"."guardian_students" FOR SELECT TO "authenticated" USING (("guardian_id" = "auth"."uid"()));



CREATE POLICY "Professors can manage course_sessions for their courses" ON "public"."course_sessions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_sessions"."course_id") AND ("c"."profile_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."courses" "c"
  WHERE (("c"."id" = "course_sessions"."course_id") AND ("c"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Professors can manage session_group_assignments for their cours" ON "public"."session_group_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."course_sessions" "cs"
     JOIN "public"."courses" "c" ON (("c"."id" = "cs"."course_id")))
  WHERE (("cs"."id" = "session_group_assignments"."course_session_id") AND ("c"."profile_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."course_sessions" "cs"
     JOIN "public"."courses" "c" ON (("c"."id" = "cs"."course_id")))
  WHERE (("cs"."id" = "session_group_assignments"."course_session_id") AND ("c"."profile_id" = "auth"."uid"())))));



CREATE POLICY "Professors can view badges in their academy" ON "public"."badges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "badges"."academy_id")))));



CREATE POLICY "Professors can view course_registration_songs" ON "public"."course_registration_songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id")))));



CREATE POLICY "Professors can view course_registrations in their academy" ON "public"."course_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id")))));



CREATE POLICY "Professors can view courses in their academy" ON "public"."courses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "courses"."academy_id")))));



CREATE POLICY "Professors can view evaluation_rubrics in their academy" ON "public"."evaluation_rubrics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "evaluation_rubrics"."academy_id")))));



CREATE POLICY "Professors can view evaluation_scales in their academy" ON "public"."evaluation_scales" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "evaluation_scales"."academy_id")))));



CREATE POLICY "Professors can view songs in their academy" ON "public"."songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Professors can view students in their academy" ON "public"."students" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "students"."academy_id") AND ("profiles"."role" = 'professor'::"text")))));



CREATE POLICY "Professors can view their own schedules" ON "public"."schedules" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Students can view badges in their academy" ON "public"."badges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."students" "s" ON (("s"."user_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'student'::"text") AND ("s"."academy_id" = "badges"."academy_id")))));



CREATE POLICY "Students can view course_sessions" ON "public"."course_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."course_registrations" "cr"
     JOIN "public"."students" "s" ON (("s"."id" = "cr"."student_id")))
  WHERE (("cr"."course_id" = "course_sessions"."course_id") AND ("s"."user_id" = "auth"."uid"())))));



CREATE POLICY "Students can view courses in their academy" ON "public"."courses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."students" "s" ON (("s"."user_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'student'::"text") AND ("s"."academy_id" = "courses"."academy_id")))));



CREATE POLICY "Students can view own course_registration_songs" ON "public"."course_registration_songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("students"."user_id" = "auth"."uid"()) AND ("students"."id" = "course_registrations"."student_id")))));



CREATE POLICY "Students can view own course_registrations" ON "public"."course_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."user_id" = "auth"."uid"()) AND ("students"."id" = "course_registrations"."student_id")))));



CREATE POLICY "Students can view own session_assignments" ON "public"."session_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students" "s"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_assignments"."course_registration_id")))
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."id" = "cr"."student_id")))));



CREATE POLICY "Students can view own session_attendances" ON "public"."session_attendances" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students" "s"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_attendances"."course_registration_id")))
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."id" = "cr"."student_id")))));



CREATE POLICY "Students can view own session_comments" ON "public"."session_comments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students" "s"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "session_comments"."course_registration_id")))
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."id" = "cr"."student_id")))));



CREATE POLICY "Students can view own song_evaluations" ON "public"."song_evaluations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students" "s"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "song_evaluations"."course_registration_id")))
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."id" = "cr"."student_id")))));



CREATE POLICY "Students can view own student_badges" ON "public"."student_badges" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students" "s"
     JOIN "public"."course_registrations" "cr" ON (("cr"."id" = "student_badges"."course_registration_id")))
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("s"."id" = "cr"."student_id")))));



CREATE POLICY "Students can view session_group_assignments for their courses" ON "public"."session_group_assignments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."students" "s"
     JOIN "public"."course_registrations" "cr" ON (("cr"."student_id" = "s"."id")))
     JOIN "public"."course_sessions" "cs" ON (("cs"."course_id" = "cr"."course_id")))
  WHERE (("s"."user_id" = "auth"."uid"()) AND ("cs"."id" = "session_group_assignments"."course_session_id")))));



CREATE POLICY "Students can view songs in their academy" ON "public"."songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."students" ON (("students"."user_id" = "profiles"."id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'student'::"text") AND ("students"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Students can view their own record" ON "public"."students" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Super admins can do everything with academies" ON "public"."academies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with badges" ON "public"."badges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with course_registration_songs" ON "public"."course_registration_songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with course_registrations" ON "public"."course_registrations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with course_sessions" ON "public"."course_sessions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with courses" ON "public"."courses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with evaluation_rubrics" ON "public"."evaluation_rubrics" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with evaluation_scales" ON "public"."evaluation_scales" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with guardian_students" ON "public"."guardian_students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with schedules" ON "public"."schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with session_assignments" ON "public"."session_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with session_attendances" ON "public"."session_attendances" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with session_comments" ON "public"."session_comments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with session_group_assignments" ON "public"."session_group_assignments" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with song_evaluations" ON "public"."song_evaluations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with songs" ON "public"."songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with student_badges" ON "public"."student_badges" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with students" ON "public"."students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own audit logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."academies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_course_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_registration_songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "director_task_completions_all" ON "public"."task_completions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."students" "s" ON (("s"."academy_id" = "p"."academy_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("s"."id" = "task_completions"."student_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."students" "s" ON (("s"."academy_id" = "p"."academy_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("s"."id" = "task_completions"."student_id")))));



ALTER TABLE "public"."evaluation_rubrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluation_scales" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guardian_students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guardian_task_completions_all" ON "public"."task_completions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."guardian_students" "gs" ON (("gs"."guardian_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'guardian'::"text") AND ("gs"."student_id" = "task_completions"."student_id"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."guardian_students" "gs" ON (("gs"."guardian_id" = "p"."id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'guardian'::"text") AND ("gs"."student_id" = "task_completions"."student_id")))) AND ("completed_by" = "auth"."uid"())));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_attendances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."session_group_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."song_evaluations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admin_task_completions_all" ON "public"."task_completions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."task_completions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_schedule_conflicts"("p_academy_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_schedule_conflicts"("p_academy_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_schedule_conflicts"("p_academy_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_schedule_conflicts"("p_professor_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_academy_id" "uuid", "p_schedule_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_schedule_conflicts"("p_professor_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_academy_id" "uuid", "p_schedule_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_schedule_conflicts"("p_professor_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_academy_id" "uuid", "p_schedule_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_default_evaluation_data"("academy_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_default_evaluation_data"("academy_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_default_evaluation_data"("academy_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_insert_default_evaluation_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_insert_default_evaluation_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_insert_default_evaluation_data"() TO "service_role";



GRANT ALL ON TABLE "public"."academies" TO "anon";
GRANT ALL ON TABLE "public"."academies" TO "authenticated";
GRANT ALL ON TABLE "public"."academies" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON TABLE "public"."contract_course_registrations" TO "anon";
GRANT ALL ON TABLE "public"."contract_course_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_course_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."contract_invoices" TO "anon";
GRANT ALL ON TABLE "public"."contract_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."contracts" TO "anon";
GRANT ALL ON TABLE "public"."contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."contracts" TO "service_role";



GRANT ALL ON TABLE "public"."course_registration_songs" TO "anon";
GRANT ALL ON TABLE "public"."course_registration_songs" TO "authenticated";
GRANT ALL ON TABLE "public"."course_registration_songs" TO "service_role";



GRANT ALL ON TABLE "public"."course_registrations" TO "anon";
GRANT ALL ON TABLE "public"."course_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."course_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."course_sessions" TO "anon";
GRANT ALL ON TABLE "public"."course_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."course_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "anon";
GRANT ALL ON TABLE "public"."courses" TO "authenticated";
GRANT ALL ON TABLE "public"."courses" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_rubrics" TO "anon";
GRANT ALL ON TABLE "public"."evaluation_rubrics" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_rubrics" TO "service_role";



GRANT ALL ON TABLE "public"."evaluation_scales" TO "anon";
GRANT ALL ON TABLE "public"."evaluation_scales" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluation_scales" TO "service_role";



GRANT ALL ON TABLE "public"."guardian_students" TO "anon";
GRANT ALL ON TABLE "public"."guardian_students" TO "authenticated";
GRANT ALL ON TABLE "public"."guardian_students" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."session_assignments" TO "anon";
GRANT ALL ON TABLE "public"."session_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."session_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."session_attendances" TO "anon";
GRANT ALL ON TABLE "public"."session_attendances" TO "authenticated";
GRANT ALL ON TABLE "public"."session_attendances" TO "service_role";



GRANT ALL ON TABLE "public"."session_comments" TO "anon";
GRANT ALL ON TABLE "public"."session_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."session_comments" TO "service_role";



GRANT ALL ON TABLE "public"."session_group_assignments" TO "anon";
GRANT ALL ON TABLE "public"."session_group_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."session_group_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."song_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."song_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."song_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."student_badges" TO "anon";
GRANT ALL ON TABLE "public"."student_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."student_badges" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."task_completions" TO "anon";
GRANT ALL ON TABLE "public"."task_completions" TO "authenticated";
GRANT ALL ON TABLE "public"."task_completions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







