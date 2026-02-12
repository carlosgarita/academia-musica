-- Global badges, rubrics, scales + academy junction tables
-- Super Admin creates items globally; assigns to academies when creating them.
-- Partimos de cero: drop and recreate.

-- 1. Drop trigger and functions
DROP TRIGGER IF EXISTS "trigger_academy_default_evaluation_data" ON "public"."academies";
DROP FUNCTION IF EXISTS "public"."trigger_insert_default_evaluation_data"();
DROP FUNCTION IF EXISTS "public"."insert_default_evaluation_data"("uuid");

-- 2. Drop dependent tables (FKs to badges, rubrics, scales)
DROP TABLE IF EXISTS "public"."student_badges";
DROP TABLE IF EXISTS "public"."song_evaluations";

-- 3. Drop old tables
DROP TABLE IF EXISTS "public"."badges";
DROP TABLE IF EXISTS "public"."evaluation_rubrics";
DROP TABLE IF EXISTS "public"."evaluation_scales";

-- 4. Create global badges (no academy_id)
CREATE TABLE "public"."badges" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "image_url" text,
    "virtud" text,
    "frase" text,
    "display_order" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamptz,
    "created_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "badges_description_check" CHECK (char_length(description) <= 500),
    CONSTRAINT "badges_frase_check" CHECK (char_length(frase) <= 500),
    CONSTRAINT "badges_image_url_check" CHECK (char_length(image_url) <= 500),
    CONSTRAINT "badges_name_check" CHECK (char_length(name) <= 100),
    CONSTRAINT "badges_virtud_check" CHECK (char_length(virtud) <= 100),
    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."badges" OWNER TO "postgres";

-- 5. Create global evaluation_rubrics (no academy_id)
CREATE TABLE "public"."evaluation_rubrics" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "is_default" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "deleted_at" timestamptz,
    "created_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "evaluation_rubrics_description_check" CHECK (char_length(description) <= 500),
    CONSTRAINT "evaluation_rubrics_name_check" CHECK (char_length(name) <= 100),
    CONSTRAINT "evaluation_rubrics_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."evaluation_rubrics" OWNER TO "postgres";

-- 6. Create global evaluation_scales (no academy_id)
CREATE TABLE "public"."evaluation_scales" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "numeric_value" integer NOT NULL,
    "is_default" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "deleted_at" timestamptz,
    "created_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "evaluation_scales_description_check" CHECK (char_length(description) <= 500),
    CONSTRAINT "evaluation_scales_name_check" CHECK (char_length(name) <= 100),
    CONSTRAINT "evaluation_scales_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."evaluation_scales" OWNER TO "postgres";

-- 7. Junction tables
CREATE TABLE "public"."academy_badges" (
    "academy_id" uuid NOT NULL,
    "badge_id" uuid NOT NULL,
    PRIMARY KEY ("academy_id", "badge_id")
);
ALTER TABLE "public"."academy_badges" OWNER TO "postgres";

CREATE TABLE "public"."academy_rubrics" (
    "academy_id" uuid NOT NULL,
    "rubric_id" uuid NOT NULL,
    PRIMARY KEY ("academy_id", "rubric_id")
);
ALTER TABLE "public"."academy_rubrics" OWNER TO "postgres";

CREATE TABLE "public"."academy_scales" (
    "academy_id" uuid NOT NULL,
    "scale_id" uuid NOT NULL,
    PRIMARY KEY ("academy_id", "scale_id")
);
ALTER TABLE "public"."academy_scales" OWNER TO "postgres";

-- 8. Recreate student_badges
CREATE TABLE "public"."student_badges" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "course_registration_id" uuid NOT NULL,
    "badge_id" uuid NOT NULL,
    "assigned_by" uuid,
    "assigned_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    "notes" text,
    "created_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "student_badges_notes_check" CHECK (char_length(notes) <= 500),
    CONSTRAINT "student_badges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_badges_course_registration_id_badge_id_key" UNIQUE ("course_registration_id", "badge_id")
);
ALTER TABLE "public"."student_badges" OWNER TO "postgres";

-- 9. Recreate song_evaluations
CREATE TABLE "public"."song_evaluations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "course_registration_id" uuid NOT NULL,
    "song_id" uuid NOT NULL,
    "rubric_id" uuid NOT NULL,
    "scale_id" uuid,
    "course_session_id" uuid,
    "created_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updated_at" timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT "song_evaluations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."song_evaluations" OWNER TO "postgres";

-- 10. Foreign keys
ALTER TABLE ONLY "public"."academy_badges"
    ADD CONSTRAINT "academy_badges_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."academy_badges"
    ADD CONSTRAINT "academy_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."academy_rubrics"
    ADD CONSTRAINT "academy_rubrics_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."academy_rubrics"
    ADD CONSTRAINT "academy_rubrics_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "public"."evaluation_rubrics"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."academy_scales"
    ADD CONSTRAINT "academy_scales_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."academy_scales"
    ADD CONSTRAINT "academy_scales_scale_id_fkey" FOREIGN KEY ("scale_id") REFERENCES "public"."evaluation_scales"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."student_badges"
    ADD CONSTRAINT "student_badges_course_registration_id_fkey" FOREIGN KEY ("course_registration_id") REFERENCES "public"."course_registrations"("id") ON DELETE CASCADE;

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

-- 11. Indexes
CREATE INDEX "idx_badges_display_order" ON "public"."badges" USING btree ("display_order");
CREATE INDEX "idx_evaluation_rubrics_display_order" ON "public"."evaluation_rubrics" USING btree ("display_order");
CREATE INDEX "idx_evaluation_scales_display_order" ON "public"."evaluation_scales" USING btree ("display_order");
CREATE INDEX "idx_evaluation_scales_numeric_value" ON "public"."evaluation_scales" USING btree ("numeric_value");
CREATE INDEX "idx_academy_badges_academy" ON "public"."academy_badges" USING btree ("academy_id");
CREATE INDEX "idx_academy_badges_badge" ON "public"."academy_badges" USING btree ("badge_id");
CREATE INDEX "idx_academy_rubrics_academy" ON "public"."academy_rubrics" USING btree ("academy_id");
CREATE INDEX "idx_academy_rubrics_rubric" ON "public"."academy_rubrics" USING btree ("rubric_id");
CREATE INDEX "idx_academy_scales_academy" ON "public"."academy_scales" USING btree ("academy_id");
CREATE INDEX "idx_academy_scales_scale" ON "public"."academy_scales" USING btree ("scale_id");
CREATE INDEX "idx_student_badges_assigned_by" ON "public"."student_badges" USING btree ("assigned_by");
CREATE INDEX "idx_student_badges_badge" ON "public"."student_badges" USING btree ("badge_id");
CREATE INDEX "idx_student_badges_course_registration" ON "public"."student_badges" USING btree ("course_registration_id");
CREATE INDEX "idx_song_evaluations_course_registration" ON "public"."song_evaluations" USING btree ("course_registration_id");
CREATE INDEX "idx_song_evaluations_course_session" ON "public"."song_evaluations" USING btree ("course_session_id") WHERE ("course_session_id" IS NOT NULL);
CREATE INDEX "idx_song_evaluations_rubric" ON "public"."song_evaluations" USING btree ("rubric_id");
CREATE INDEX "idx_song_evaluations_song" ON "public"."song_evaluations" USING btree ("song_id");
CREATE UNIQUE INDEX "idx_song_evaluations_unique_session" ON "public"."song_evaluations" USING btree ("course_registration_id", "song_id", "course_session_id", "rubric_id") WHERE ("course_session_id" IS NOT NULL);

-- 12. Triggers
CREATE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."badges" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."evaluation_rubrics" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."evaluation_scales" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."song_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- 13. RLS
ALTER TABLE "public"."badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."evaluation_rubrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."evaluation_scales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."academy_badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."academy_rubrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."academy_scales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."student_badges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."song_evaluations" ENABLE ROW LEVEL SECURITY;

-- Super admin: full access to global catalog
CREATE POLICY "Super admins manage badges" ON "public"."badges" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

CREATE POLICY "Super admins manage evaluation_rubrics" ON "public"."evaluation_rubrics" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

CREATE POLICY "Super admins manage evaluation_scales" ON "public"."evaluation_scales" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

CREATE POLICY "Super admins manage academy_badges" ON "public"."academy_badges" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

CREATE POLICY "Super admins manage academy_rubrics" ON "public"."academy_rubrics" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

CREATE POLICY "Super admins manage academy_scales" ON "public"."academy_scales" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

-- Directors/professors: SELECT badges/rubrics/scales only via academy assignment (handled by API with service_role)
-- For RLS: allow SELECT for directors/professors when badge/rubric/scale is in their academy
CREATE POLICY "Directors professors view badges via academy" ON "public"."badges" FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."academy_badges" ab
            JOIN "public"."profiles" p ON p.id = auth.uid()
            WHERE ab.badge_id = badges.id AND ab.academy_id = p.academy_id
            AND p.role IN ('director', 'professor')
        )
    );

CREATE POLICY "Directors professors view rubrics via academy" ON "public"."evaluation_rubrics" FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."academy_rubrics" ar
            JOIN "public"."profiles" p ON p.id = auth.uid()
            WHERE ar.rubric_id = evaluation_rubrics.id AND ar.academy_id = p.academy_id
            AND p.role IN ('director', 'professor')
        )
    );

CREATE POLICY "Directors professors view scales via academy" ON "public"."evaluation_scales" FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."academy_scales" acsc
            JOIN "public"."profiles" p ON p.id = auth.uid()
            WHERE acsc.scale_id = evaluation_scales.id AND acsc.academy_id = p.academy_id
            AND p.role IN ('director', 'professor')
        )
    );

-- Guardians, students: view badges (for their children/academy) - via same logic
CREATE POLICY "Guardians view badges for children academy" ON "public"."badges" FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."guardian_students" gs
            JOIN "public"."students" s ON s.id = gs.student_id
            JOIN "public"."academy_badges" ab ON ab.academy_id = s.academy_id AND ab.badge_id = badges.id
            WHERE gs.guardian_id = auth.uid()
        )
    );

CREATE POLICY "Students view badges in academy" ON "public"."badges" FOR SELECT TO "authenticated"
    USING (
        EXISTS (
            SELECT 1 FROM "public"."students" s
            JOIN "public"."academy_badges" ab ON ab.academy_id = s.academy_id AND ab.badge_id = badges.id
            WHERE s.user_id = auth.uid()
        )
    );

-- student_badges and song_evaluations policies (same as before, via course_registration -> academy)
CREATE POLICY "Directors manage student_badges" ON "public"."student_badges" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = student_badges.course_registration_id
        AND (p.role = 'director' AND p.academy_id = cr.academy_id OR p.role = 'super_admin'))))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = student_badges.course_registration_id
        AND (p.role = 'director' AND p.academy_id = cr.academy_id OR p.role = 'super_admin'))));

CREATE POLICY "Directors manage song_evaluations" ON "public"."song_evaluations" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = song_evaluations.course_registration_id
        AND (p.role = 'director' AND p.academy_id = cr.academy_id OR p.role = 'super_admin'))))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = song_evaluations.course_registration_id
        AND (p.role = 'director' AND p.academy_id = cr.academy_id OR p.role = 'super_admin'))));

CREATE POLICY "Guardians view student_badges" ON "public"."student_badges" FOR SELECT TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."guardian_students" gs ON gs.student_id = cr.student_id
        WHERE cr.id = student_badges.course_registration_id AND gs.guardian_id = auth.uid())));

CREATE POLICY "Guardians view song_evaluations" ON "public"."song_evaluations" FOR SELECT TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."guardian_students" gs ON gs.student_id = cr.student_id
        WHERE cr.id = song_evaluations.course_registration_id AND gs.guardian_id = auth.uid())));

CREATE POLICY "Students view own student_badges" ON "public"."student_badges" FOR SELECT TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."students" s ON s.id = cr.student_id
        WHERE cr.id = student_badges.course_registration_id AND s.user_id = auth.uid())));

CREATE POLICY "Students view own song_evaluations" ON "public"."song_evaluations" FOR SELECT TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."students" s ON s.id = cr.student_id
        WHERE cr.id = song_evaluations.course_registration_id AND s.user_id = auth.uid())));

CREATE POLICY "Super admins manage student_badges" ON "public"."student_badges" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

CREATE POLICY "Super admins manage song_evaluations" ON "public"."song_evaluations" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."profiles" WHERE "profiles"."id" = auth.uid() AND "profiles"."role" = 'super_admin')));

-- Professors: manage song_evaluations and student_badges in their academy (via course -> professor)
CREATE POLICY "Professors manage student_badges" ON "public"."student_badges" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."courses" c ON c.id = cr.course_id
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = student_badges.course_registration_id
        AND c.profile_id = p.id AND p.role = 'professor')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."courses" c ON c.id = cr.course_id
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = student_badges.course_registration_id
        AND c.profile_id = p.id AND p.role = 'professor')));

CREATE POLICY "Professors manage song_evaluations" ON "public"."song_evaluations" TO "authenticated"
    USING ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."courses" c ON c.id = cr.course_id
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = song_evaluations.course_registration_id
        AND c.profile_id = p.id AND p.role = 'professor')))
    WITH CHECK ((EXISTS (SELECT 1 FROM "public"."course_registrations" cr
        JOIN "public"."courses" c ON c.id = cr.course_id
        JOIN "public"."profiles" p ON p.id = auth.uid()
        WHERE cr.id = song_evaluations.course_registration_id
        AND c.profile_id = p.id AND p.role = 'professor')));

-- 14. Grants
GRANT ALL ON TABLE "public"."badges" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."evaluation_rubrics" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."evaluation_scales" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."academy_badges" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."academy_rubrics" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."academy_scales" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."student_badges" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."song_evaluations" TO "anon", "authenticated", "service_role";
