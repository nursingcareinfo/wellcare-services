CREATE TABLE IF NOT EXISTS patient_equipment (
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

ALTER TABLE patient_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on patient_equipment" ON patient_equipment FOR ALL USING (true) WITH CHECK (true);
