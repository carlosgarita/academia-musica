-- Add billing day, grace period and penalty % to contracts (for enrollment and financial status)
-- Fecha de cobro: día del mes (1-31). Periodo de gracia: días antes de multa. Porcentaje de multa por morosidad.

ALTER TABLE "public"."contracts"
  ADD COLUMN IF NOT EXISTS "billing_day" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "grace_period_days" integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "penalty_percent" numeric(5,2) NOT NULL DEFAULT 20;

ALTER TABLE "public"."contracts"
  DROP CONSTRAINT IF EXISTS "contracts_billing_day_check";
ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_billing_day_check" CHECK ("billing_day" >= 1 AND "billing_day" <= 31);

ALTER TABLE "public"."contracts"
  DROP CONSTRAINT IF EXISTS "contracts_grace_period_days_check";
ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_grace_period_days_check" CHECK ("grace_period_days" IN (3, 5, 7, 15));

ALTER TABLE "public"."contracts"
  DROP CONSTRAINT IF EXISTS "contracts_penalty_percent_check";
ALTER TABLE "public"."contracts"
  ADD CONSTRAINT "contracts_penalty_percent_check" CHECK ("penalty_percent" IN (5, 10, 15, 20, 25, 30, 35, 40, 45, 50));

COMMENT ON COLUMN "public"."contracts"."billing_day" IS 'Día del mes en que se efectúa el cobro (1-31). Default: 1.';
COMMENT ON COLUMN "public"."contracts"."grace_period_days" IS 'Días de gracia para pagar antes de multa (3, 5, 7 o 15).';
COMMENT ON COLUMN "public"."contracts"."penalty_percent" IS 'Porcentaje de multa por morosidad (5-50%). Default: 20.';
