


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


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






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
    CONSTRAINT "audit_logs_action_check" CHECK (("char_length"("action") <= 50)),
    CONSTRAINT "audit_logs_table_name_check" CHECK (("char_length"("table_name") <= 100))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


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
    "period_id" "uuid" NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "enrollment_date" "date" DEFAULT CURRENT_DATE,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "profile_id" "uuid",
    CONSTRAINT "course_registrations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."course_registrations" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."period_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "period_id" "uuid" NOT NULL,
    "date_type" "text" NOT NULL,
    "date" "date" NOT NULL,
    "comment" "text",
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "subject_id" "uuid",
    CONSTRAINT "period_dates_comment_check" CHECK (("char_length"("comment") <= 500)),
    CONSTRAINT "period_dates_date_type_check" CHECK (("date_type" = ANY (ARRAY['inicio'::"text", 'cierre'::"text", 'feriado'::"text", 'recital'::"text", 'clase'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."period_dates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "period" "text" NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "periods_period_check" CHECK (("period" = ANY (ARRAY['I'::"text", 'II'::"text", 'III'::"text", 'IV'::"text", 'V'::"text", 'VI'::"text"]))),
    CONSTRAINT "periods_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professor_subject_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "period_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."professor_subject_periods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."professor_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "profile_id" "uuid" NOT NULL
);


ALTER TABLE "public"."professor_subjects" OWNER TO "postgres";


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
    "subject_id" "uuid",
    "deleted_at" timestamp with time zone,
    "period_id" "uuid",
    CONSTRAINT "schedules_day_of_week_check" CHECK ((("day_of_week" >= 1) AND ("day_of_week" <= 7))),
    CONSTRAINT "schedules_name_check" CHECK (("char_length"("name") <= 100)),
    CONSTRAINT "schedules_time_check" CHECK (("end_time" > "start_time")),
    CONSTRAINT "schedules_time_range_check" CHECK ((("start_time" >= '07:00:00'::time without time zone) AND ("end_time" <= '22:00:00'::time without time zone)))
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


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
    CONSTRAINT "students_additional_info_check" CHECK (("char_length"("additional_info") <= 500)),
    CONSTRAINT "students_enrollment_status_check" CHECK (("enrollment_status" = ANY (ARRAY['inscrito'::"text", 'retirado'::"text", 'graduado'::"text"]))),
    CONSTRAINT "students_first_name_check" CHECK (("char_length"("first_name") <= 50)),
    CONSTRAINT "students_last_name_check" CHECK (("char_length"("last_name") <= 50))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "academy_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


ALTER TABLE ONLY "public"."academies"
    ADD CONSTRAINT "academies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_course_registration_id_song_id_key" UNIQUE ("course_registration_id", "song_id");



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_guardian_id_student_id_key" UNIQUE ("guardian_id", "student_id");



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_student_id_key" UNIQUE ("student_id");



ALTER TABLE ONLY "public"."period_dates"
    ADD CONSTRAINT "period_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_academy_id_year_period_key" UNIQUE ("academy_id", "year", "period");



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professor_subject_periods"
    ADD CONSTRAINT "professor_subject_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professor_subject_periods"
    ADD CONSTRAINT "professor_subject_periods_profile_id_subject_id_period_id_key" UNIQUE ("profile_id", "subject_id", "period_id");



ALTER TABLE ONLY "public"."professor_subjects"
    ADD CONSTRAINT "professor_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."professor_subjects"
    ADD CONSTRAINT "professor_subjects_profile_id_subject_id_key" UNIQUE ("profile_id", "subject_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "course_registrations_legacy_unique" ON "public"."course_registrations" USING "btree" ("student_id", "subject_id", "period_id") WHERE ("profile_id" IS NULL);



CREATE UNIQUE INDEX "course_registrations_student_subject_period_profile_key" ON "public"."course_registrations" USING "btree" ("student_id", "subject_id", "period_id", "profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_audit_logs_created_at" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_table_record" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_audit_logs_user_id" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_course_registration_songs_registration" ON "public"."course_registration_songs" USING "btree" ("course_registration_id");



CREATE INDEX "idx_course_registration_songs_song" ON "public"."course_registration_songs" USING "btree" ("song_id");



CREATE INDEX "idx_course_registrations_academy_id" ON "public"."course_registrations" USING "btree" ("academy_id");



CREATE INDEX "idx_course_registrations_period_id" ON "public"."course_registrations" USING "btree" ("period_id");



CREATE INDEX "idx_course_registrations_profile_id" ON "public"."course_registrations" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_course_registrations_student_id" ON "public"."course_registrations" USING "btree" ("student_id");



CREATE INDEX "idx_course_registrations_subject_id" ON "public"."course_registrations" USING "btree" ("subject_id");



CREATE INDEX "idx_guardian_students_academy" ON "public"."guardian_students" USING "btree" ("academy_id");



CREATE INDEX "idx_guardian_students_guardian" ON "public"."guardian_students" USING "btree" ("guardian_id");



CREATE INDEX "idx_guardian_students_student" ON "public"."guardian_students" USING "btree" ("student_id");



CREATE INDEX "idx_period_dates_date" ON "public"."period_dates" USING "btree" ("date");



CREATE INDEX "idx_period_dates_period_id" ON "public"."period_dates" USING "btree" ("period_id");



CREATE INDEX "idx_period_dates_subject_id" ON "public"."period_dates" USING "btree" ("subject_id") WHERE ("subject_id" IS NOT NULL);



CREATE INDEX "idx_periods_academy_id" ON "public"."periods" USING "btree" ("academy_id");



CREATE INDEX "idx_periods_year" ON "public"."periods" USING "btree" ("year");



CREATE INDEX "idx_professor_subject_periods_period" ON "public"."professor_subject_periods" USING "btree" ("period_id");



CREATE INDEX "idx_professor_subject_periods_profile" ON "public"."professor_subject_periods" USING "btree" ("profile_id");



CREATE INDEX "idx_professor_subject_periods_subject" ON "public"."professor_subject_periods" USING "btree" ("subject_id");



CREATE INDEX "idx_professor_subjects_profile" ON "public"."professor_subjects" USING "btree" ("profile_id");



CREATE INDEX "idx_professor_subjects_subject" ON "public"."professor_subjects" USING "btree" ("subject_id");



CREATE INDEX "idx_schedules_academy" ON "public"."schedules" USING "btree" ("academy_id");



CREATE INDEX "idx_schedules_period_id" ON "public"."schedules" USING "btree" ("period_id") WHERE ("period_id" IS NOT NULL);



CREATE INDEX "idx_schedules_profile_day_time" ON "public"."schedules" USING "btree" ("profile_id", "day_of_week", "start_time", "end_time");



CREATE INDEX "idx_schedules_subject" ON "public"."schedules" USING "btree" ("subject_id");



CREATE INDEX "idx_songs_academy_id" ON "public"."songs" USING "btree" ("academy_id");



CREATE INDEX "idx_songs_difficulty_level" ON "public"."songs" USING "btree" ("difficulty_level");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."academies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."course_registrations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."guardian_students" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."period_dates" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."periods" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."schedules" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."songs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."subjects" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registration_songs"
    ADD CONSTRAINT "course_registration_songs_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."course_registrations"
    ADD CONSTRAINT "course_registrations_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."guardian_students"
    ADD CONSTRAINT "guardian_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_dates"
    ADD CONSTRAINT "period_dates_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."period_dates"
    ADD CONSTRAINT "period_dates_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."periods"
    ADD CONSTRAINT "periods_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professor_subject_periods"
    ADD CONSTRAINT "professor_subject_periods_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professor_subject_periods"
    ADD CONSTRAINT "professor_subject_periods_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professor_subject_periods"
    ADD CONSTRAINT "professor_subject_periods_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professor_subjects"
    ADD CONSTRAINT "professor_subjects_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."professor_subjects"
    ADD CONSTRAINT "professor_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."periods"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."songs"
    ADD CONSTRAINT "songs_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;



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



CREATE POLICY "Directors can manage guardian_students in their academy" ON "public"."guardian_students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "guardian_students"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage period_dates in their academy" ON "public"."period_dates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."periods" ON (("periods"."id" = "period_dates"."period_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "periods"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."periods" ON (("periods"."id" = "period_dates"."period_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Directors can manage periods in their academy" ON "public"."periods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "periods"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Directors can manage professor_subject_periods in their academy" ON "public"."professor_subject_periods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."subjects" "s" ON (("s"."id" = "professor_subject_periods"."subject_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "s"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."subjects" "s" ON (("s"."id" = "professor_subject_periods"."subject_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'director'::"text") AND ("p"."academy_id" = "s"."academy_id")))));



CREATE POLICY "Directors can manage professor_subjects in their academy" ON "public"."professor_subjects" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "director_profile"
     JOIN "public"."profiles" "professor_profile" ON (("professor_profile"."id" = "professor_subjects"."profile_id")))
  WHERE (("director_profile"."id" = "auth"."uid"()) AND ("director_profile"."academy_id" = "professor_profile"."academy_id") AND ("director_profile"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage schedules in their academy" ON "public"."schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "schedules"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage songs in their academy" ON "public"."songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "songs"."academy_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'director'::"text") AND ("profiles"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Directors can manage students in their academy" ON "public"."students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "students"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can manage subjects in their academy" ON "public"."subjects" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "subjects"."academy_id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Directors can view their own academy" ON "public"."academies" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "academies"."id") AND ("profiles"."role" = 'director'::"text")))));



CREATE POLICY "Guardians can view course_registration_songs for their children" ON "public"."course_registration_songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."guardian_students"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("guardian_students"."guardian_id" = "auth"."uid"()) AND ("guardian_students"."student_id" = "course_registrations"."student_id")))));



CREATE POLICY "Guardians can view course_registrations for their children" ON "public"."course_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."guardian_students"
  WHERE (("guardian_students"."guardian_id" = "auth"."uid"()) AND ("guardian_students"."student_id" = "course_registrations"."student_id")))));



CREATE POLICY "Guardians can view period_dates in their children's academy" ON "public"."period_dates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ((("public"."profiles"
     JOIN "public"."guardian_students" ON (("guardian_students"."guardian_id" = "profiles"."id")))
     JOIN "public"."students" ON (("students"."id" = "guardian_students"."student_id")))
     JOIN "public"."periods" ON (("periods"."id" = "period_dates"."period_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'guardian'::"text") AND ("students"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Guardians can view periods in their children's academy" ON "public"."periods" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles"
     JOIN "public"."guardian_students" ON (("guardian_students"."guardian_id" = "profiles"."id")))
     JOIN "public"."students" ON (("students"."id" = "guardian_students"."student_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'guardian'::"text") AND ("students"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Guardians can view songs in their children's academy" ON "public"."songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles"
     JOIN "public"."guardian_students" ON (("guardian_students"."guardian_id" = "profiles"."id")))
     JOIN "public"."students" ON (("students"."id" = "guardian_students"."student_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'guardian'::"text") AND ("students"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Guardians can view their assigned students" ON "public"."students" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."guardian_students"
  WHERE (("guardian_students"."guardian_id" = "auth"."uid"()) AND ("guardian_students"."student_id" = "students"."id")))));



CREATE POLICY "Guardians can view their own student assignments" ON "public"."guardian_students" FOR SELECT TO "authenticated" USING (("guardian_id" = "auth"."uid"()));



CREATE POLICY "Professors can view course_registration_songs" ON "public"."course_registration_songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id")))));



CREATE POLICY "Professors can view course_registrations in their academy" ON "public"."course_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "course_registrations"."academy_id")))));



CREATE POLICY "Professors can view own professor_subject_periods" ON "public"."professor_subject_periods" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Professors can view period_dates in their academy" ON "public"."period_dates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."periods" ON (("periods"."id" = "period_dates"."period_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Professors can view periods in their academy" ON "public"."periods" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Professors can view songs in their academy" ON "public"."songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'professor'::"text") AND ("profiles"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Professors can view students in their academy" ON "public"."students" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "students"."academy_id") AND ("profiles"."role" = 'professor'::"text")))));



CREATE POLICY "Professors can view subjects in their academy" ON "public"."subjects" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."academy_id" = "subjects"."academy_id") AND ("profiles"."role" = 'professor'::"text")))));



CREATE POLICY "Professors can view their own schedules" ON "public"."schedules" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Professors can view their own subjects" ON "public"."professor_subjects" FOR SELECT TO "authenticated" USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Students can view own course_registration_songs" ON "public"."course_registration_songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."students"
     JOIN "public"."course_registrations" ON (("course_registrations"."id" = "course_registration_songs"."course_registration_id")))
  WHERE (("students"."user_id" = "auth"."uid"()) AND ("students"."id" = "course_registrations"."student_id")))));



CREATE POLICY "Students can view own course_registrations" ON "public"."course_registrations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."user_id" = "auth"."uid"()) AND ("students"."id" = "course_registrations"."student_id")))));



CREATE POLICY "Students can view period_dates in their academy" ON "public"."period_dates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."profiles"
     JOIN "public"."students" ON (("students"."user_id" = "profiles"."id")))
     JOIN "public"."periods" ON (("periods"."id" = "period_dates"."period_id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'student'::"text") AND ("students"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Students can view periods in their academy" ON "public"."periods" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."students" ON (("students"."user_id" = "profiles"."id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'student'::"text") AND ("students"."academy_id" = "periods"."academy_id")))));



CREATE POLICY "Students can view songs in their academy" ON "public"."songs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles"
     JOIN "public"."students" ON (("students"."user_id" = "profiles"."id")))
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'student'::"text") AND ("students"."academy_id" = "songs"."academy_id")))));



CREATE POLICY "Students can view their own record" ON "public"."students" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Super admins can do everything with academies" ON "public"."academies" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with course_registration_songs" ON "public"."course_registration_songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with course_registrations" ON "public"."course_registrations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with guardian_students" ON "public"."guardian_students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with period_dates" ON "public"."period_dates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with periods" ON "public"."periods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with professor_subject_periods" ON "public"."professor_subject_periods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with professor_subjects" ON "public"."professor_subjects" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with schedules" ON "public"."schedules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with songs" ON "public"."songs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with students" ON "public"."students" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can do everything with subjects" ON "public"."subjects" TO "authenticated" USING ((EXISTS ( SELECT 1
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


ALTER TABLE "public"."course_registration_songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."course_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guardian_students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."period_dates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professor_subject_periods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."professor_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





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


















GRANT ALL ON TABLE "public"."academies" TO "anon";
GRANT ALL ON TABLE "public"."academies" TO "authenticated";
GRANT ALL ON TABLE "public"."academies" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."course_registration_songs" TO "anon";
GRANT ALL ON TABLE "public"."course_registration_songs" TO "authenticated";
GRANT ALL ON TABLE "public"."course_registration_songs" TO "service_role";



GRANT ALL ON TABLE "public"."course_registrations" TO "anon";
GRANT ALL ON TABLE "public"."course_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."course_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."guardian_students" TO "anon";
GRANT ALL ON TABLE "public"."guardian_students" TO "authenticated";
GRANT ALL ON TABLE "public"."guardian_students" TO "service_role";



GRANT ALL ON TABLE "public"."period_dates" TO "anon";
GRANT ALL ON TABLE "public"."period_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."period_dates" TO "service_role";



GRANT ALL ON TABLE "public"."periods" TO "anon";
GRANT ALL ON TABLE "public"."periods" TO "authenticated";
GRANT ALL ON TABLE "public"."periods" TO "service_role";



GRANT ALL ON TABLE "public"."professor_subject_periods" TO "anon";
GRANT ALL ON TABLE "public"."professor_subject_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."professor_subject_periods" TO "service_role";



GRANT ALL ON TABLE "public"."professor_subjects" TO "anon";
GRANT ALL ON TABLE "public"."professor_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."professor_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."songs" TO "anon";
GRANT ALL ON TABLE "public"."songs" TO "authenticated";
GRANT ALL ON TABLE "public"."songs" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";









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































