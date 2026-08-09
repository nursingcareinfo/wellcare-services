ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS service_end_date date,
  ADD COLUMN IF NOT EXISTS service_end_reason text,
  ADD COLUMN IF NOT EXISTS service_end_notes text;
