CREATE TABLE IF NOT EXISTS staff_intakes (
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

ALTER TABLE staff_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_insert_staff ON staff_intakes
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY auth_select_staff ON staff_intakes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY auth_update_staff ON staff_intakes
  FOR UPDATE TO authenticated
  USING (true);
