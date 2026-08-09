CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  attendance_date DATE NOT NULL,
  status TEXT CHECK (status IN ('Present', 'Absent', 'Late', 'Half-Day')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on staff_attendance" ON staff_attendance FOR ALL USING (true) WITH CHECK (true);
