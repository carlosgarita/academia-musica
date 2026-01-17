-- ============================================
-- Migration: Schedules (Horarios) Module
-- Execute this in Supabase SQL Editor
-- This script creates the schedules table and modifies enrollments
-- ============================================

-- ============================================
-- 1. Create schedules table
-- ============================================

create table if not exists public.schedules (
  id uuid default gen_random_uuid() primary key,
  academy_id uuid references public.academies on delete cascade not null,
  name text not null check (char_length(name) <= 100),
  professor_id uuid references public.professors on delete cascade not null,
  day_of_week integer not null check (day_of_week between 1 and 7), -- 1=Lunes, 7=Domingo
  start_time time not null,
  end_time time not null,
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

-- Create index for faster conflict checks
create index if not exists idx_schedules_professor_day_time 
  on public.schedules(professor_id, day_of_week, start_time, end_time);

create index if not exists idx_schedules_academy 
  on public.schedules(academy_id);

-- ============================================
-- 2. Modify enrollments table to include schedule_id
-- ============================================

-- Add schedule_id column (nullable, since enrollments can be for subjects OR schedules)
alter table public.enrollments
  add column if not exists schedule_id uuid references public.schedules on delete cascade;

-- Update unique constraint to allow either subject_id OR schedule_id
-- First, drop the old unique constraint if it exists
do $$
begin
  if exists (
    select 1 from pg_constraint 
    where conname = 'enrollments_student_id_subject_id_teacher_id_key'
  ) then
    alter table public.enrollments
      drop constraint enrollments_student_id_subject_id_teacher_id_key;
  end if;
end $$;

-- Add new constraint: either subject_id or schedule_id must be provided, but not both
alter table public.enrollments
  add constraint enrollments_subject_or_schedule_check 
  check (
    (subject_id is not null and schedule_id is null) or
    (subject_id is null and schedule_id is not null)
  );

-- Add unique constraint for schedule enrollments
create unique index if not exists enrollments_student_schedule_unique
  on public.enrollments(student_id, schedule_id)
  where schedule_id is not null;

-- Keep unique constraint for subject enrollments
create unique index if not exists enrollments_student_subject_teacher_unique
  on public.enrollments(student_id, subject_id, teacher_id)
  where subject_id is not null;

-- ============================================
-- 3. Create updated_at trigger for schedules
-- ============================================

create trigger handle_updated_at
  before update on public.schedules
  for each row
  execute function public.handle_updated_at();

-- ============================================
-- 4. Create function to check schedule conflicts
-- ============================================

create or replace function public.check_schedule_conflicts(
  p_professor_id uuid,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_academy_id uuid,
  p_schedule_id uuid default null -- null for new schedules, uuid for updates
)
returns table(
  conflict_type text,
  conflict_message text,
  conflicting_schedule_id uuid,
  conflicting_schedule_name text
) as $$
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
$$ language plpgsql security definer;

-- ============================================
-- 5. Create function to check student schedule conflicts
-- ============================================

create or replace function public.check_student_schedule_conflicts(
  p_student_id uuid,
  p_schedule_id uuid,
  p_academy_id uuid,
  p_exclude_enrollment_id uuid default null -- optional: exclude a specific enrollment when updating
)
returns table(
  conflict_type text,
  conflict_message text,
  conflicting_schedule_id uuid,
  conflicting_schedule_name text,
  conflicting_schedule_day text,
  conflicting_schedule_time text
) as $$
declare
  v_target_schedule record;
  v_conflict record;
  v_day_names text[] := array['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
begin
  -- Get the target schedule details
  select day_of_week, start_time, end_time
  into v_target_schedule
  from public.schedules
  where id = p_schedule_id;

  if not found then
    return;
  end if;

      -- Check for conflicts with other schedules the student is enrolled in
      for v_conflict in
        select 
          s.id,
          s.name,
          s.day_of_week,
          s.start_time,
          s.end_time,
          'student' as conflict_type,
          'El estudiante ya está inscrito en otra clase en este horario' as message
        from public.schedules s
        inner join public.enrollments e on e.schedule_id = s.id
        where e.student_id = p_student_id
          and e.status = 'active'
          and (p_schedule_id is null or e.schedule_id != p_schedule_id) -- exclude the schedule we're trying to enroll in
          and s.academy_id = p_academy_id
          and s.day_of_week = v_target_schedule.day_of_week -- same day
          and (
            -- Time overlap
            (v_target_schedule.start_time >= s.start_time and v_target_schedule.start_time < s.end_time) or
            (v_target_schedule.end_time > s.start_time and v_target_schedule.end_time <= s.end_time) or
            (v_target_schedule.start_time <= s.start_time and v_target_schedule.end_time >= s.end_time)
          )
  loop
    return query select 
      v_conflict.conflict_type::text,
      v_conflict.message::text,
      v_conflict.id,
      v_conflict.name::text,
      v_day_names[v_conflict.day_of_week]::text,
      (v_conflict.start_time::text || ' - ' || v_conflict.end_time::text)::text;
  end loop;

  return;
end;
$$ language plpgsql security definer;

-- ============================================
-- 6. Enable RLS on schedules
-- ============================================

alter table public.schedules enable row level security;

-- ============================================
-- 7. Create RLS policies for schedules
-- ============================================

-- Super admins can do everything
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

-- Directors can manage schedules in their academy
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

-- Professors can view schedules where they are assigned
create policy "Professors can view their assigned schedules"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.professors on professors.user_id = profiles.id
    where profiles.id = auth.uid()
    and profiles.role = 'professor'
    and professors.id = schedules.professor_id
  ));

-- Guardians can view schedules where their students are enrolled
create policy "Guardians can view schedules of their students"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.profiles
    inner join public.students on students.guardian_id = profiles.id
    inner join public.enrollments on enrollments.student_id = students.id
    where profiles.id = auth.uid()
    and profiles.role = 'guardian'
    and enrollments.schedule_id = schedules.id
    and enrollments.status = 'active'
  ));

-- Students can view schedules they are enrolled in
create policy "Students can view their enrolled schedules"
  on public.schedules
  as permissive
  for select
  to authenticated
  using (exists (
    select 1 from public.students
    inner join public.enrollments on enrollments.student_id = students.id
    where students.user_id = auth.uid()
    and enrollments.schedule_id = schedules.id
    and enrollments.status = 'active'
  ));

-- ============================================
-- 8. Update enrollments policies to include schedule enrollments
-- ============================================

-- The existing policies should work, but we need to ensure they cover schedule enrollments
-- The current policies check academy_id, which is present in both subject and schedule enrollments

-- ============================================
-- Migration completed!
-- ============================================
-- 
-- Summary:
-- 1. Created schedules table with day_of_week, start_time, end_time
-- 2. Modified enrollments to include schedule_id (optional)
-- 3. Created check_schedule_conflicts function for professor conflicts
-- 4. Created check_student_schedule_conflicts function for student conflicts
-- 5. Enabled RLS and created policies for schedules
-- 6. Added indexes for performance
-- ============================================
