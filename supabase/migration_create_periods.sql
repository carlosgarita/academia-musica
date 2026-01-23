-- ============================================
-- Migration: Create periods (cronogramas) and period_dates tables
-- Execute this in Supabase SQL Editor
-- ============================================

-- Create periods table (cronogramas)
create table if not exists public.periods (
  id uuid default gen_random_uuid() primary key,
  academy_id uuid references public.academies on delete cascade not null,
  year integer not null check (year >= 2000 and year <= 2100),
  period text not null check (period in ('I', 'II', 'III', 'IV', 'V', 'VI')),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(academy_id, year, period)
);

-- Create index for academy_id for faster queries
create index if not exists idx_periods_academy_id on public.periods(academy_id);
create index if not exists idx_periods_year on public.periods(year);

-- Create period_dates table (fechas del cronograma)
create table if not exists public.period_dates (
  id uuid default gen_random_uuid() primary key,
  period_id uuid references public.periods on delete cascade not null,
  date_type text not null check (date_type in ('inicio', 'cierre', 'feriado', 'recital', 'clase', 'otro')),
  date date not null,
  schedule_id uuid references public.schedules on delete set null,
  comment text check (char_length(comment) <= 500),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for period_dates
create index if not exists idx_period_dates_period_id on public.period_dates(period_id);
create index if not exists idx_period_dates_date on public.period_dates(date);
create index if not exists idx_period_dates_schedule_id on public.period_dates(schedule_id) where schedule_id is not null;

-- Create updated_at triggers
drop trigger if exists handle_updated_at on public.periods;
create trigger handle_updated_at
  before update on public.periods
  for each row
  execute function public.handle_updated_at();

drop trigger if exists handle_updated_at on public.period_dates;
create trigger handle_updated_at
  before update on public.period_dates
  for each row
  execute function public.handle_updated_at();

-- Enable RLS
alter table public.periods enable row level security;
alter table public.period_dates enable row level security;

-- RLS Policies for periods

-- Super admins can do everything
create policy "Super admins can do everything with periods"
  on public.periods
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );

-- Directors can manage periods in their academy
create policy "Directors can manage periods in their academy"
  on public.periods
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'director'
      and profiles.academy_id = periods.academy_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'director'
      and profiles.academy_id = periods.academy_id
    )
  );

-- Professors can view periods in their academy
create policy "Professors can view periods in their academy"
  on public.periods
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'professor'
      and profiles.academy_id = periods.academy_id
    )
  );

-- Students can view periods in their academy
create policy "Students can view periods in their academy"
  on public.periods
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.students on students.user_id = profiles.id
      where profiles.id = auth.uid()
      and profiles.role = 'student'
      and students.academy_id = periods.academy_id
    )
  );

-- Guardians can view periods in their children's academy
create policy "Guardians can view periods in their children's academy"
  on public.periods
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.guardian_students on guardian_students.guardian_id = profiles.id
      inner join public.students on students.id = guardian_students.student_id
      where profiles.id = auth.uid()
      and profiles.role = 'guardian'
      and students.academy_id = periods.academy_id
    )
  );

-- RLS Policies for period_dates

-- Super admins can do everything
create policy "Super admins can do everything with period_dates"
  on public.period_dates
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'super_admin'
    )
  );

-- Directors can manage period_dates in their academy
create policy "Directors can manage period_dates in their academy"
  on public.period_dates
  as permissive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.periods on periods.id = period_dates.period_id
      where profiles.id = auth.uid()
      and profiles.role = 'director'
      and profiles.academy_id = periods.academy_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      inner join public.periods on periods.id = period_dates.period_id
      where profiles.id = auth.uid()
      and profiles.role = 'director'
      and profiles.academy_id = periods.academy_id
    )
  );

-- Professors can view period_dates in their academy
create policy "Professors can view period_dates in their academy"
  on public.period_dates
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.periods on periods.id = period_dates.period_id
      where profiles.id = auth.uid()
      and profiles.role = 'professor'
      and profiles.academy_id = periods.academy_id
    )
  );

-- Students can view period_dates in their academy
create policy "Students can view period_dates in their academy"
  on public.period_dates
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.students on students.user_id = profiles.id
      inner join public.periods on periods.id = period_dates.period_id
      where profiles.id = auth.uid()
      and profiles.role = 'student'
      and students.academy_id = periods.academy_id
    )
  );

-- Guardians can view period_dates in their children's academy
create policy "Guardians can view period_dates in their children's academy"
  on public.period_dates
  as permissive
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      inner join public.guardian_students on guardian_students.guardian_id = profiles.id
      inner join public.students on students.id = guardian_students.student_id
      inner join public.periods on periods.id = period_dates.period_id
      where profiles.id = auth.uid()
      and profiles.role = 'guardian'
      and students.academy_id = periods.academy_id
    )
  );

-- ============================================
-- Migration completed!
-- ============================================
