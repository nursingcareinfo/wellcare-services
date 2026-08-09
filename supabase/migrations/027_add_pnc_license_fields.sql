-- 027: PNC (Pakistan Nursing Council) License Fields
-- Adds registration number + expiry date tracking to each staff record
-- Run with: npx supabase db push

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pnc_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS pnc_license_expiry_date DATE;

COMMENT ON COLUMN employees.pnc_registration_number IS 'Pakistan Nursing Council (PNC) / Pakistan Nursing & Midwifery Council (PN&MC) registration or license number.';
COMMENT ON COLUMN employees.pnc_license_expiry_date IS 'Expiry date of the staff member PNC license card.';
