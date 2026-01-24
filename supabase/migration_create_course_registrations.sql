-- ============================================
-- Migration: Create course_registrations and course_registration_songs tables
-- Matrícula de estudiantes a clases por periodo, con canciones asignadas
-- Execute this in Supabase SQL Editor
-- ============================================

-- Course registrations (matrículas: estudiante + clase/subject + periodo)
create table if not exists public.course_registrations (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade not null,
  period_id uuid references public.periods on delete cascade not null,
  academy_id uuid references public.academies on delete cascade not null,
  status text default 'active' check (status in ('active', 'completed', 'cancelled')),
  enrollment_date date default current_date,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, subject_id, period_id)
);

create index if not exists idx_course_registrations_academy_id on public.course_registrations(academy_id);
create index if not exists idx_course_registrations_student_id on public.course_registrations(student_id);
create index if not exists idx_course_registrations_period_id on public.course_registrations(period_id);
create index if not exists idx_course_registrations_subject_id on public.course_registrations(subject_id);

-- Course registration songs (canciones por matrícula)
create table if not exists public.course_registration_songs (
  id uuid default gen_random_uuid() primary key,
  course_registration_id uuid references public.course_registrations on delete cascade not null,
  song_id uuid references public.songs on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(course_registration_id, song_id)
);

create index if not exists idx_course_registration_songs_registration on public.course_registration_songs(course_registration_id);
create index if not exists idx_course_registration_songs_song on public.course_registration_songs(song_id);

-- Trigger for course_registrations
drop trigger if exists handle_updated_at on public.course_registrations;
create trigger handle_updated_at
  before update on public.course_registrations
  for each row
  execute function public.handle_updated_at();

-- Enable RLS
alter table public.course_registrations enable row level security;
alter table public.course_registration_songs enable row level security;

-- RLS: course_registrations
drop policy if exists "Super admins can do everything with course_registrations" on public.course_registrations;
drop policy if exists "Directors can manage course_registrations in their academy" on public.course_registrations;
drop policy if exists "Professors can view course_registrations in their academy" on public.course_registrations;
drop policy if exists "Students can view own course_registrations" on public.course_registrations;
drop policy if exists "Guardians can view course_registrations for their children" on public.course_registrations;

create policy "Super admins can do everything with course_registrations"
  on public.course_registrations
  as permissive for all to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin')
  );

create policy "Directors can manage course_registrations in their academy"
  on public.course_registrations
  as permissive for all to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = course_registrations.academy_id)
  )
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = course_registrations.academy_id)
  );

create policy "Professors can view course_registrations in their academy"
  on public.course_registrations
  as permissive for select to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'professor' and profiles.academy_id = course_registrations.academy_id)
  );

create policy "Students can view own course_registrations"
  on public.course_registrations
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.students
      where students.user_id = auth.uid()
      and students.id = course_registrations.student_id
    )
  );

create policy "Guardians can view course_registrations for their children"
  on public.course_registrations
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.guardian_students
      where guardian_students.guardian_id = auth.uid()
      and guardian_students.student_id = course_registrations.student_id
    )
  );

-- RLS: course_registration_songs
drop policy if exists "Super admins can do everything with course_registration_songs" on public.course_registration_songs;
drop policy if exists "Directors can manage course_registration_songs" on public.course_registration_songs;
drop policy if exists "Professors can view course_registration_songs" on public.course_registration_songs;
drop policy if exists "Students can view own course_registration_songs" on public.course_registration_songs;
drop policy if exists "Guardians can view course_registration_songs for their children" on public.course_registration_songs;

create policy "Super admins can do everything with course_registration_songs"
  on public.course_registration_songs
  as permissive for all to authenticated
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'super_admin')
  );

create policy "Directors can manage course_registration_songs"
  on public.course_registration_songs
  as permissive for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.course_registrations on course_registrations.id = course_registration_songs.course_registration_id
      where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = course_registrations.academy_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      inner join public.course_registrations on course_registrations.id = course_registration_songs.course_registration_id
      where profiles.id = auth.uid() and profiles.role = 'director' and profiles.academy_id = course_registrations.academy_id
    )
  );

create policy "Professors can view course_registration_songs"
  on public.course_registration_songs
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.course_registrations on course_registrations.id = course_registration_songs.course_registration_id
      where profiles.id = auth.uid() and profiles.role = 'professor' and profiles.academy_id = course_registrations.academy_id
    )
  );

create policy "Students can view own course_registration_songs"
  on public.course_registration_songs
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.students
      inner join public.course_registrations on course_registrations.id = course_registration_songs.course_registration_id
      where students.user_id = auth.uid() and students.id = course_registrations.student_id
    )
  );

create policy "Guardians can view course_registration_songs for their children"
  on public.course_registration_songs
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.guardian_students
      inner join public.course_registrations on course_registrations.id = course_registration_songs.course_registration_id
      where guardian_students.guardian_id = auth.uid() and guardian_students.student_id = course_registrations.student_id
    )
  );

-- ============================================
-- Migration completed!
-- ============================================
