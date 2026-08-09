-- Supabase Schema V2 for HMSP High-Performance Ledger
-- Karachi HQ Manual Management Interface (Manual PKR Logic)

-- 1. Employees Table (Personnel Archive)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emp_no TEXT UNIQUE, -- NC-KHI format
  full_name TEXT,
  father_husband_name TEXT,
  cnic_number TEXT UNIQUE CHECK (cnic_number IS NULL OR cnic_number ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$'),
  dob DATE,
  gender TEXT,
  marital_status TEXT,
  religion TEXT,
  phone_primary TEXT CHECK (phone_primary IS NULL OR phone_primary ~ '^\+92 [0-9]{3} [0-9]{7}$'),
  whatsapp_number TEXT,
  district TEXT, -- Karachi Districts: South, East, West, Central, Malir, Korangi, Keamari
  complete_address TEXT,
  position_applied TEXT DEFAULT 'Nurse', -- RN, BSN, Midwife, ICU/Anes, etc.
  experience_years NUMERIC(4, 2),
  shift_preference TEXT, -- Day, Night, 24 hrs
  expected_salary_pkr NUMERIC(12, 2),
  day_shift_rate NUMERIC(12, 2),    -- Per 12-hour morning shift
  night_shift_rate NUMERIC(12, 2),  -- Per 12-hour night shift
  preferred_payment_method TEXT, -- Cash, JazzCash, EasyPesa, Bank
  bank_info JSONB, -- { "bank_name": "", "account_no": "", "iban": "" }
  is_active BOOLEAN DEFAULT true,
  is_available BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  is_acknowledgment_signed BOOLEAN DEFAULT false,
  data_confidence TEXT DEFAULT 'High',
  critical_missing_info BOOLEAN DEFAULT false,
  missing_fields_list TEXT[],
  pnc_registration_number TEXT,      -- PNC / PN&MC license registration number
  pnc_license_expiry_date DATE,      -- Expiry date of PNC license card
  document_urls JSONB,
  rating NUMERIC(3, 2) DEFAULT 5.00,
  category TEXT, -- Nurse, Attendant, etc.
  relative_info JSONB, -- { "name": "", "relationship": "", "phone": "" }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Patients Table (Revenue Archive)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  cnic TEXT CHECK (cnic IS NULL OR cnic ~ '^[0-9]{5}-[0-9]{7}-[0-9]{1}$'),
  mobile_number TEXT,
  district TEXT,
  complete_address TEXT,
  service_type TEXT, -- '12h_day', '12h_night', '24h'
  service_duration TEXT, -- Enum: '12h_Day', '12h_Night', '24h'
  monthly_package_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Active', 'Pending', 'Completed', 'Cancelled')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Manual Shifts Table (The Heart of the Ledger)
CREATE TABLE IF NOT EXISTS manual_shifts (
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
  -- Prevent double booking
  UNIQUE(employee_id, shift_date, shift_type)
);

-- 4. Salary Advances Table
CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  amount_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'JazzCash', 'EasyPesa', 'Bank')),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Settled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Staff Attendance Table (Daily Presence Tracking)
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Day', 'Night', 'Present', 'Absent', 'Late', 'Half-Day')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on staff_attendance" ON staff_attendance FOR ALL USING (true) WITH CHECK (true);

-- 6. Financial Intelligence Views
-- Daily Margin View: Profit per residence
CREATE OR REPLACE VIEW real_time_margin_view AS
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

-- Staff Accrual View: Monthly earning per employee (handles completed shifts, penalty deductions, and advances)
CREATE OR REPLACE VIEW staff_accrual_view AS
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
  SELECT
    employee_id,
    SUM(amount_pkr) as total_advances
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

-- 7. Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on employees" ON employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on patients" ON patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on manual_shifts" ON manual_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on salary_advances" ON salary_advances FOR ALL USING (true) WITH CHECK (true);
