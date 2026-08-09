# Patient Intake + Service Agreement Form

## Architecture

- **Form**: Standalone `intake.html` at `/hmsp-dashboard/intake.html` — no auth, no React
- **Database**: New Supabase `patient_intakes` table
- **Dashboard**: New "Intakes" view in App.tsx to review submissions
- **Link to send**: `https://nursingcareinfo.github.io/hmsp-dashboard/intake.html`

## Form Flow (Single Page, 3 Sections)

### Section 1 — Patient Details

- Full Name, Father/Husband Name, Gender, CNIC, DOB, Mobile/WhatsApp
- District, Complete Address
- Service Type: Nurse / Babysitter / Midwife / Attendant / Care Taker

### Section 2 — Service Agreement (Contract)

- HMSP terms and conditions displayed as formatted text
- Patient accepts by typing Full Name + CNIC (digital signature)
- Billing rate input, service start date

### Section 3 — Equipment Rental (Optional)

- Add rows: Equipment name (dropdown), Quantity, Start/End dates, Daily fee
- Items: Ventilator, Cardiac Monitor, Oxygen Concentrator, Suction Machine, Nebulizer, Hospital Bed, Wheelchair, Walker, Patient Lift, Bedside Commode

## Database Schema

```sql
CREATE TABLE patient_intakes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),

  -- Patient info
  full_name       TEXT NOT NULL,
  guardian_name   TEXT NOT NULL,
  gender          TEXT NOT NULL,
  cnic            TEXT NOT NULL,
  date_of_birth   DATE,
  mobile          TEXT NOT NULL,
  district        TEXT,
  address         TEXT,
  service_type    TEXT NOT NULL,

  -- Agreement
  billing_rate    NUMERIC,
  start_date      DATE,
  signatory_name  TEXT NOT NULL,
  signatory_cnic  TEXT NOT NULL,
  terms_accepted  BOOLEAN DEFAULT false,

  -- Equipment
  equipment       JSONB DEFAULT '[]'::jsonb,

  -- Status (staff only)
  status          TEXT DEFAULT 'pending',
  staff_notes     TEXT
);
```

## Security

- `patient_intakes` table: RLS enabled
- **Anon role**: INSERT only (patients can submit, can't read others)
- **Authenticated role**: SELECT + UPDATE (staff can view and manage)

## Dashboard View

- New nav item "Intakes" → dispatches to `PatientIntakesView.tsx`
- Table of submissions with status badges
- Click to expand details, update status, add notes
