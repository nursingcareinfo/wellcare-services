# Patient Edit & Equipment Rental — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable editing existing patients and tracking equipment rentals per patient.

**Architecture:** Edit modal reuses existing registration form patterns. Equipment rental uses a new DB table with per-item tracking (rent/return history). Both live inside PatientView.tsx.

**Tech Stack:** React 19, TypeScript, Supabase (PostgreSQL), TailwindCSS 4, lucide-react

**Design Doc:** `docs/plans/2026-06-18-patient-edit-equipment-design.md`

---

### Task 1: Database Migration — `patient_equipment` table

**Files:**
- Create: `supabase/migrations/20260618000000_create_patient_equipment.sql`

**Step 1: Write the migration SQL**

```sql
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
```

**Step 2: Apply the migration**

Run: `supabase db push` or apply migration via Supabase CLI

Expected: Table created, no errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260618000000_create_patient_equipment.sql
git commit -m "feat: add patient_equipment table for equipment rental tracking"
```

---

### Task 2: Backend — Add `updatePatient()` to patientService

**Files:**
- Modify: `src/services/patientService.ts` (after line 38)

**Step 1: Add the method**

Insert after `createPatient`:

```typescript
async updatePatient(id: string, data: Partial<Patient>) {
  const { data: result, error } = await supabase
    .from('patients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return result as Patient
},
```

**Step 2: Verify**

Check: `npm run lint` passes.

**Step 3: Commit**

```bash
git add src/services/patientService.ts
git commit -m "feat: add updatePatient method to patientService"
```

---

### Task 3: Backend — Add `equipmentService` to patientService

**Files:**
- Modify: `src/services/patientService.ts` (at end of file)

**Step 1: Add the service object**

After `patientInvoiceService`, add:

```typescript
export interface PatientEquipment {
  id?: string
  patient_id: string
  item_name: string
  quantity: number
  rental_rate: number
  rate_period: 'daily' | 'monthly'
  rented_at: string
  returned_at?: string | null
  status: 'rented' | 'returned'
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export const equipmentService = {
  async getForPatient(patientId: string) {
    const { data, error } = await supabase
      .from('patient_equipment')
      .select('*')
      .eq('patient_id', patientId)
      .order('rented_at', { ascending: false })
    if (error) throw error
    return data as PatientEquipment[]
  },

  async addItem(data: Omit<PatientEquipment, 'id' | 'created_at' | 'updated_at'>) {
    const { data: result, error } = await supabase
      .from('patient_equipment')
      .insert([data])
      .select()
      .single()
    if (error) throw error
    return result as PatientEquipment
  },

  async markReturned(id: string) {
    const { data, error } = await supabase
      .from('patient_equipment')
      .update({
        returned_at: new Date().toISOString().split('T')[0],
        status: 'returned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as PatientEquipment
  },
}
```

**Step 2: Verify**

Check: `npm run lint` passes.

**Step 3: Commit**

```bash
git add src/services/patientService.ts
git commit -m "feat: add equipmentService for patient equipment rental tracking"
```

---

### Task 4: Frontend — Add Edit Modal to PatientView.tsx

**Files:**
- Modify: `src/components/PatientView.tsx`

**Step 1: Add state variables for edit mode**

Add after existing state (around line 70):

```typescript
const [editPatient, setEditPatient] = useState<any | null>(null)
const [editFormData, setEditFormData] = useState({ ... })
const [isSavingEdit, setIsSavingEdit] = useState(false)
```

**Step 2: Add Edit button to each patient card header**

Next to the patient name, add an Edit (pencil) icon button that opens the edit modal with pre-populated data.

**Step 3: Add the Edit Modal**

A modal overlay (fixed position) containing:
- Same fields as registration form
- Pre-populated from the selected patient
- "Save Changes" calls `patientService.updatePatient(editPatient.id, editFormData)`
- Close/Cancel buttons
- On success: refresh patient list, close modal

**Step 4: Verify**

Run `npm run lint` — no type errors.
Run `npm run dev` — manual test: click edit on a patient, modify a field, save, verify it persists.

**Step 5: Commit**

```bash
git add src/components/PatientView.tsx
git commit -m "feat: add edit modal for patient info and services"
```

---

### Task 5: Frontend — Add Equipment Rental Section to PatientView.tsx

**Files:**
- Modify: `src/components/PatientView.tsx`

**Step 1: Add equipment state and loading**

```typescript
const [equipment, setEquipment] = useState<Record<string, PatientEquipment[]>>({})
const [expandedEquipment, setExpandedEquipment] = useState<Set<string>>(new Set())
const [showEquipForm, setShowEquipForm] = useState<string | null>(null) // patient.id when form open
const [equipForm, setEquipForm] = useState({ item_name: '', quantity: 1, rental_rate: '', rate_period: 'monthly', rented_at: new Date().toISOString().split('T')[0] })
```

Load equipment data in `loadPatients` alongside assignments/intake status.

**Step 2: Add collapsible equipment section per patient card**

Insert between the invoices section and the action buttons (between line 958 and 960).

Collapsed: shows summary count + total monthly rental cost.
Expanded: table of items with columns (item, qty, rate, period, rented date, status badge).
Each rented item has a "Return" button.
An "+ Add Equipment" button opens an inline form.

**Step 3: Add Equipment form**

Inline form (same style as assign staff) with fields: item name (text), quantity (number), rental rate (number), rate period (select: daily/monthly), rented date (date picker).
Submit calls `equipmentService.addItem({ patient_id, ... })`.

**Step 4: Verify**

Run `npm run lint` — no errors.
Run `npm run dev` — manual test: open a patient, expand equipment, add an item, verify it appears, return it, verify history shows.

**Step 5: Commit**

```bash
git add src/components/PatientView.tsx
git commit -m "feat: add equipment rental section to patient cards"
```

---

## Summary

| # | Task | Files | Time |
|---|------|-------|------|
| 1 | DB migration | `supabase/migrations/20260618000000_create_patient_equipment.sql` | 5m |
| 2 | Backend: updatePatient | `src/services/patientService.ts` | 5m |
| 3 | Backend: equipmentService | `src/services/patientService.ts` | 5m |
| 4 | Frontend: Edit Modal | `src/components/PatientView.tsx` | 15m |
| 5 | Frontend: Equipment Section | `src/components/PatientView.tsx` | 20m |
