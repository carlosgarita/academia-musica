-- Migration: Create contracts, contract_course_registrations, and contract_invoices tables
-- For financial management: contracts link guardians to course enrollments with monthly invoices

-- 1. contracts: main contract record
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_amount numeric(12, 2) NOT NULL CHECK (monthly_amount >= 0),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contracts_academy ON public.contracts(academy_id);
CREATE INDEX IF NOT EXISTS idx_contracts_guardian ON public.contracts(guardian_id);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON public.contracts(start_date, end_date);

COMMENT ON TABLE public.contracts IS 'Financial contracts between academy and guardians for course enrollments';

-- 2. contract_course_registrations: links contract to specific student enrollments
CREATE TABLE IF NOT EXISTS public.contract_course_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  course_registration_id uuid NOT NULL REFERENCES public.course_registrations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(contract_id, course_registration_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_course_registrations_contract ON public.contract_course_registrations(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_course_registrations_registration ON public.contract_course_registrations(course_registration_id);

COMMENT ON TABLE public.contract_course_registrations IS 'Links contracts to specific student course enrollments being charged';

-- 3. contract_invoices: monthly invoices for each contract
-- status: 'pendiente' | 'pagado' (atrasado is computed when displaying: pendiente + month passed)
CREATE TABLE IF NOT EXISTS public.contract_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  month date NOT NULL, -- first day of month (e.g. 2026-02-01)
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'pagado')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(contract_id, month)
);

CREATE INDEX IF NOT EXISTS idx_contract_invoices_contract ON public.contract_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_invoices_month ON public.contract_invoices(month);

COMMENT ON TABLE public.contract_invoices IS 'Monthly invoices for contracts; atrasado computed in UI when pendiente + month passed';

-- 4. Triggers for updated_at (use existing handle_updated_at function)
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.contract_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_course_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_invoices ENABLE ROW LEVEL SECURITY;

-- Directors and super_admin: full access in their academy
CREATE POLICY "Directors can manage contracts in their academy"
  ON public.contracts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('director', 'super_admin')
      AND (p.role = 'super_admin' OR p.academy_id = contracts.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('director', 'super_admin')
      AND (p.role = 'super_admin' OR p.academy_id = contracts.academy_id)
    )
  );

CREATE POLICY "Directors can manage contract_course_registrations"
  ON public.contract_course_registrations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = contract_course_registrations.contract_id
      AND p.role IN ('director', 'super_admin')
      AND (p.role = 'super_admin' OR p.academy_id = c.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = contract_course_registrations.contract_id
      AND p.role IN ('director', 'super_admin')
      AND (p.role = 'super_admin' OR p.academy_id = c.academy_id)
    )
  );

CREATE POLICY "Directors can manage contract_invoices"
  ON public.contract_invoices FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = contract_invoices.contract_id
      AND p.role IN ('director', 'super_admin')
      AND (p.role = 'super_admin' OR p.academy_id = c.academy_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = contract_invoices.contract_id
      AND p.role IN ('director', 'super_admin')
      AND (p.role = 'super_admin' OR p.academy_id = c.academy_id)
    )
  );

-- Grants
GRANT ALL ON public.contracts TO authenticated;
GRANT ALL ON public.contract_course_registrations TO authenticated;
GRANT ALL ON public.contract_invoices TO authenticated;
