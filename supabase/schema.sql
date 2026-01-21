-- Create tables
create table public.academies (
  id uuid default gen_random_uuid() primary key,
  name text not null check (char_length(name) <= 100),
  address text check (char_length(address) <= 200),
  phone text check (char_length(phone) <= 20),
  website text check (char_length(website) <= 200),
  logo_url text check (char_length(logo_url) <= 500),
  timezone text default 'UTC' check (char_length(timezone) <= 50),
  status text default 'active' check (status in ('active', 'inactive')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null check (char_length(email) <= 255),
  first_name text check (char_length(first_name) <= 50),
  last_name text check (char_length(last_name) <= 50),
  phone text check (char_length(phone) <= 20),
  role text not null check (role in ('super_admin', 'director', 'professor', 'student', 'guardian')),
  academy_id uuid references public.academies on delete set null,
  status text default 'active' check (status in ('active', 'inactive')),
  additional_info text check (char_length(additional_info) <= 500),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Professors table removed - all professor data is now in profiles table

create table public.students (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade,
  academy_id uuid references public.academies on delete cascade not null,
  first_name text not null check (char_length(first_name) <= 50),
  last_name text not null check (char_length(last_name) <= 50),
  date_of_birth date,
  additional_info text check (char_length(additional_info) <= 500),
  enrollment_status text default 'inscrito' check (enrollment_status in ('inscrito', 'retirado', 'graduado')),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Subjects table (materias)
create table public.subjects (
  id uuid default gen_random_uuid() primary key,
  academy_id uuid references public.academies on delete cascade not null,
  name text not null check (char_length(name) <= 100),
  description text check (char_length(description) <= 500),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Professor subjects junction table (profesor-materia)
-- Now references profiles directly (where role='professor')
create table public.professor_subjects (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, subject_id)
);

-- Schedules table (horarios/clases)
-- profile_id references profiles (where role='professor')
-- subject_id references subjects; name is denormalized from subject for display (or legacy free text)
create table public.schedules (
  id uuid default gen_random_uuid() primary key,
  academy_id uuid references public.academies on delete cascade not null,
  subject_id uuid references public.subjects on delete set null,
  name text not null check (char_length(name) <= 100),
  profile_id uuid references public.profiles on delete cascade not null,
  day_of_week integer not null check (day_of_week between 1 and 7), -- 1=Lunes, 7=Domingo
  start_time time not null,
  end_time time not null,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Ensure end_time is after start_time
  constraint schedules_time_check check (end_time > start_time),
  -- Ensure time range is between 7:00 AM and 10:00 PM
  constraint schedules_time_range_check check (
    start_time >= '07:00:00'::time 
    and end_time <= '22:00:00'::time
  )
);

-- Audit logs table (for GDPR compliance and audit trail)
create table public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  action text not null check (char_length(action) <= 50),
  table_name text not null check (char_length(table_name) <= 100),
  record_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_table_record on public.audit_logs(table_name, record_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at);

-- Guardian students table (encargado-estudiante)
-- One-to-one relationship: each student can have only one guardian
create table public.guardian_students (
  id uuid default gen_random_uuid() primary key,
  guardian_id uuid references public.profiles on delete cascade not null,
  student_id uuid references public.students on delete cascade not null,
  academy_id uuid references public.academies on delete cascade not null,
  relationship text check (char_length(relationship) <= 50), -- e.g., "Padre", "Madre", "Tutor"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(guardian_id, student_id),
  unique(student_id) -- Ensures one student can only have one guardian
);

-- Enrollments table (inscripciones: estudiante-materia-profesor)
-- teacher_id now references profiles (where role='professor')
create table public.enrollments (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students on delete cascade not null,
  subject_id uuid references public.subjects on delete cascade,
  schedule_id uuid references public.schedules on delete set null,
  teacher_id uuid references public.profiles on delete cascade not null,
  academy_id uuid references public.academies on delete cascade not null,
  enrollment_date date default current_date,
  status text default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(student_id, subject_id, teacher_id),
  unique(student_id, schedule_id)
);

-- Create updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create updated_at triggers for all tables
create trigger handle_updated_at
  before update on public.academies
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.students
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.subjects
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.professor_subjects
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.schedules
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.guardian_students
  for each row
  execute function public.handle_updated_at();

create trigger handle_updated_at
  before update on public.enrollments
  for each row
  execute function public.handle_updated_at();

-- Set up Row Level Security (RLS)
alter table public.academies enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.professor_subjects enable row level security;
alter table public.schedules enable row level security;
alter table public.guardian_students enable row level security;
alter table public.enrollments enable row level security;

-- Academies policies
create policy "Super admins can do everything with academies"
  on public.academies
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can view their own academy"
  on public.academies
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = academies.id
    and profiles.role = 'director'
  ));

-- Profiles policies
-- Note: We can't check profiles.role inside profiles policies due to recursion
-- Super admins policy is handled via service role or bypassed for specific operations

create policy "Users can view their own profile"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  as permissive
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Professors are now in profiles table, no separate policies needed

-- Students policies
create policy "Super admins can do everything with students"
  on public.students
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can manage students in their academy"
  on public.students
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = students.academy_id
    and profiles.role = 'director'
  ));

create policy "Professors can view students in their academy"
  on public.students
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = students.academy_id
    and profiles.role = 'professor'
  ));

create policy "Students can view their own record"
  on public.students
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid());

-- Guardians can view their assigned students (via guardian_students table)
create policy "Guardians can view their assigned students"
  on public.students
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.guardian_students
    where guardian_students.guardian_id = auth.uid()
    and guardian_students.student_id = students.id
  ));

-- Subjects policies
create policy "Super admins can do everything with subjects"
  on public.subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can manage subjects in their academy"
  on public.subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = subjects.academy_id
    and profiles.role = 'director'
  ));

create policy "Professors can view subjects in their academy"
  on public.subjects
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = subjects.academy_id
    and profiles.role = 'professor'
  ));

-- Professor subjects policies
create policy "Super admins can do everything with professor_subjects"
  on public.professor_subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can manage professor_subjects in their academy"
  on public.professor_subjects
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles director_profile
    inner join public.profiles professor_profile on professor_profile.id = professor_subjects.profile_id
    where director_profile.id = auth.uid()
    and director_profile.academy_id = professor_profile.academy_id
    and director_profile.role = 'director'
  ));

create policy "Professors can view their own subjects"
  on public.professor_subjects
  as permissive
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Schedules policies
create policy "Super admins can do everything with schedules"
  on public.schedules
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can manage schedules in their academy"
  on public.schedules
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = schedules.academy_id
    and profiles.role = 'director'
  ));

create policy "Professors can view their own schedules"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (profile_id = auth.uid());

create policy "Guardians can view schedules for their children"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.guardian_students on guardian_students.guardian_id = profiles.id
    inner join public.enrollments on enrollments.student_id = guardian_students.student_id
    where profiles.id = auth.uid()
    and profiles.role = 'guardian'
    and enrollments.schedule_id = schedules.id
  ));

create policy "Students can view their schedules"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.students on students.user_id = profiles.id
    inner join public.enrollments on enrollments.student_id = students.id
    where profiles.id = auth.uid()
    and profiles.role = 'student'
    and enrollments.schedule_id = schedules.id
  ));

-- Enrollments policies
create policy "Super admins can do everything with enrollments"
  on public.enrollments
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can manage enrollments in their academy"
  on public.enrollments
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = enrollments.academy_id
    and profiles.role = 'director'
  ));

create policy "Professors can view enrollments for their classes"
  on public.enrollments
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.schedules on schedules.profile_id = profiles.id
    where profiles.id = auth.uid()
    and profiles.role = 'professor'
    and enrollments.schedule_id = schedules.id
  ));

create policy "Students can view their own enrollments"
  on public.enrollments
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.students
    where students.user_id = auth.uid()
    and students.id = enrollments.student_id
  ));

-- Guardian students policies
create policy "Super admins can do everything with guardian_students"
  on public.guardian_students
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));

create policy "Directors can manage guardian_students in their academy"
  on public.guardian_students
  as permissive
  for all
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.academy_id = guardian_students.academy_id
    and profiles.role = 'director'
  ));

create policy "Guardians can view their own student assignments"
  on public.guardian_students
  as permissive
  for select
  to authenticated
  using (guardian_id = auth.uid());

-- Audit logs policies
alter table public.audit_logs enable row level security;

create policy "Users can view their own audit logs"
  on public.audit_logs
  as permissive
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Super admins can view all audit logs"
  on public.audit_logs
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  ));
