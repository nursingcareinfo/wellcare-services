-- ============================================================
-- HMSP Dashboard — FULL DB RECREATE (drop + create from scratch)
-- Target: live Supabase project zumysyuenxrylauzvokl
-- Run in: Supabase dashboard → SQL Editor (or: supabase db query)
-- Safe: all tables were wiped to 0 rows first (clean slate).
-- ============================================================

BEGIN;

-- ── 1. DROP everything (views first, then tables, CASCADE for FKs) ──
DROP VIEW IF EXISTS real_time_margin_view CASCADE;
DROP VIEW IF EXISTS staff_accrual_view CASCADE;
DROP TABLE IF EXISTS patient_equipment CASCADE;
DROP TABLE IF EXISTS patient_invoices CASCADE;
DROP TABLE IF EXISTS patient_intakes CASCADE;
DROP TABLE IF EXISTS staff_intakes CASCADE;
DROP TABLE IF EXISTS staff_attendance CASCADE;
DROP TABLE IF EXISTS salary_advances CASCADE;
DROP TABLE IF EXISTS manual_shifts CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- ── 2. employees (schema V2 + is_blacklisted + service_end) ──
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_no TEXT UNIQUE,
  full_name TEXT,
  father_husband_name TEXT,
  cnic_number TEXT UNIQUE CHECK (cnic_number IS NULL OR cnic_number ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$'),
  dob DATE,
  gender TEXT,
  marital_status TEXT,
  religion TEXT,
  phone_primary TEXT CHECK (phone_primary IS NULL OR phone_primary ~ '^\+92 [0-9]{3} [0-9]{7}$'),
  whatsapp_number TEXT,
  district TEXT,
  complete_address TEXT,
  position_applied TEXT DEFAULT 'Nurse',
  experience_years NUMERIC(4, 2),
  shift_preference TEXT,
  expected_salary_pkr NUMERIC(12, 2),
  preferred_payment_method TEXT,
  bank_info JSONB,
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  is_acknowledgment_signed BOOLEAN DEFAULT false,
  is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  data_confidence TEXT DEFAULT 'High',
  critical_missing_info BOOLEAN DEFAULT false,
  missing_fields_list TEXT[],
  pnc_registration_number TEXT,
  pnc_license_expiry_date DATE,
  document_urls JSONB,
  rating NUMERIC(3, 2) DEFAULT 5.00,
  category TEXT,
  relative_info JSONB,
  service_end_date DATE,
  service_end_reason TEXT,
  service_end_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. patients (patient_name is source of truth; full_name is GENERATED —
--    the app reads full_name, writes patient_name) ──
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  full_name TEXT GENERATED ALWAYS AS (patient_name) STORED,
  cnic TEXT CHECK (cnic IS NULL OR cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$'),
  mobile_number TEXT,
  district TEXT,
  complete_address TEXT,
  service_type TEXT,
  service_duration TEXT,
  monthly_package_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Active', 'Pending', 'Completed', 'Cancelled')),
  start_date DATE,
  end_date DATE,
  service_end_date DATE,
  service_end_reason TEXT,
  service_end_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. manual_shifts (the heart of the ledger) ──
CREATE TABLE manual_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  patient_id UUID REFERENCES patients(id),
  shift_date DATE NOT NULL,
  shift_type TEXT CHECK (shift_type IN ('Morning', 'Night')),
  decided_rate_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  attendance_status TEXT DEFAULT 'Scheduled' CHECK (attendance_status IN ('Scheduled', 'Completed', 'Abandoned')),
  penalty_applied BOOLEAN DEFAULT false,
  is_completed BOOLEAN GENERATED ALWAYS AS (attendance_status = 'Completed') STORED,
  is_abandoned BOOLEAN GENERATED ALWAYS AS (attendance_status = 'Abandoned') STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, shift_date, shift_type)
);

-- ── 5. salary_advances ──
CREATE TABLE salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  amount_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'JazzCash', 'EasyPesa', 'Bank')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Settled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. staff_attendance ──
CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Day', 'Night', 'Present', 'Absent', 'Late', 'Half-Day')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

-- ── 7. patient_intakes (self-serve intake forms) ──
CREATE TABLE patient_intakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  full_name TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  gender TEXT NOT NULL,
  cnic TEXT NOT NULL,
  date_of_birth DATE,
  mobile TEXT NOT NULL,
  district TEXT,
  address TEXT,
  service_type TEXT NOT NULL,
  billing_rate NUMERIC,
  start_date DATE,
  signatory_name TEXT NOT NULL,
  signatory_cnic TEXT NOT NULL,
  terms_accepted BOOLEAN DEFAULT false,
  equipment JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  staff_notes TEXT
);

-- ── 8. patient_invoices (reconstructed from live DB + dedup constraint) ──
CREATE TABLE patient_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  invoice_number TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount_pkr NUMERIC(12, 2),          -- legacy column (kept for compatibility)
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Paid', 'Cancelled')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- prevent the duplicate-invoice bug (10x same period was generated before)
  UNIQUE (patient_id, period_start, period_end)
);

-- lookups: real_time_margin_view joins manual_shifts on (patient_id, shift_date)
CREATE INDEX IF NOT EXISTS manual_shifts_patient_date_idx
  ON manual_shifts (patient_id, shift_date);
CREATE INDEX IF NOT EXISTS patient_invoices_status_idx
  ON patient_invoices (status);

-- ── 9. patient_equipment ──
CREATE TABLE patient_equipment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  rental_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  rate_period TEXT NOT NULL DEFAULT 'monthly' CHECK (rate_period IN ('daily', 'monthly')),
  rented_at   DATE NOT NULL DEFAULT CURRENT_DATE,
  returned_at DATE,
  status      TEXT NOT NULL DEFAULT 'rented' CHECK (status IN ('rented', 'returned')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. staff_intakes (was MISSING → Staff Intakes view 404) ──
CREATE TABLE staff_intakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  full_name TEXT NOT NULL,
  father_husband_name TEXT,
  gender TEXT,
  cnic_number TEXT,
  date_of_birth DATE,
  phone_primary TEXT NOT NULL,
  district TEXT,
  complete_address TEXT,
  position_applied TEXT,
  experience_years NUMERIC,
  shift_preference TEXT,
  expected_salary_pkr NUMERIC,
  bank_name TEXT,
  account_no TEXT,
  account_title TEXT,
  iban TEXT,
  status TEXT DEFAULT 'pending',
  staff_notes TEXT,
  terms_accepted BOOLEAN DEFAULT false,
  document_urls JSONB DEFAULT '{}'::jsonb
);

-- ── 11. Financial intelligence views (security_invoker: views run as the
--    calling role so RLS applies — per Supabase Postgres 15+ best practice) ──
CREATE OR REPLACE VIEW real_time_margin_view
WITH (security_invoker = true) AS
SELECT
  p.id as patient_id,
  p.patient_name,
  p.monthly_package_pkr,
  (p.monthly_package_pkr / 30.0) as daily_revenue,
  COALESCE(SUM(ms.decided_rate_pkr), 0) as daily_cost,
  ((p.monthly_package_pkr / 30.0) - COALESCE(SUM(ms.decided_rate_pkr), 0)) as daily_margin
FROM patients p
LEFT JOIN manual_shifts ms ON p.id = ms.patient_id AND ms.shift_date = CURRENT_DATE
WHERE p.status = 'Active'
GROUP BY p.id, p.patient_name, p.monthly_package_pkr;

CREATE OR REPLACE VIEW staff_accrual_view
WITH (security_invoker = true) AS
WITH shift_stats AS (
  SELECT
    employee_id,
    COUNT(id) FILTER (WHERE attendance_status = 'Completed') as total_shifts_completed,
    COUNT(id) FILTER (WHERE attendance_status = 'Abandoned') as total_shifts_abandoned,
    SUM(CASE WHEN attendance_status = 'Completed' THEN decided_rate_pkr ELSE 0 END) as gross_earnings,
    SUM(CASE WHEN penalty_applied THEN decided_rate_pkr ELSE 0 END) as total_penalties
  FROM manual_shifts
  GROUP BY employee_id
),
advance_stats AS (
  SELECT employee_id, SUM(amount_pkr) as total_advances
  FROM salary_advances
  WHERE status = 'Pending'
  GROUP BY employee_id
)
SELECT
  e.id as employee_id,
  e.full_name,
  e.emp_no,
  COALESCE(ss.total_shifts_completed, 0) as total_shifts_completed,
  COALESCE(ss.total_shifts_abandoned, 0) as total_shifts_abandoned,
  COALESCE(ss.gross_earnings, 0) as gross_earnings,
  COALESCE(ss.total_penalties, 0) as total_penalties,
  COALESCE(asub.total_advances, 0) as total_advances,
  (COALESCE(ss.gross_earnings, 0) - COALESCE(ss.total_penalties, 0) - COALESCE(asub.total_advances, 0)) as total_earnings_accrued
FROM employees e
LEFT JOIN shift_stats ss ON e.id = ss.employee_id
LEFT JOIN advance_stats asub ON e.id = asub.employee_id;

-- ── 12. RLS: demo app uses the anon/publishable key for ALL access ──
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on patients" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on manual_shifts" ON manual_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on salary_advances" ON salary_advances FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on staff_attendance" ON staff_attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on patient_intakes" ON patient_intakes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on patient_invoices" ON patient_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on patient_equipment" ON patient_equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on staff_intakes" ON staff_intakes FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated; -- views need SELECT only

COMMIT;
