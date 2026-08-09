CREATE TABLE IF NOT EXISTS patient_intakes (
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

ALTER TABLE patient_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_insert ON patient_intakes
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY auth_select ON patient_intakes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY auth_update ON patient_intakes
  FOR UPDATE TO authenticated
  USING (true);
