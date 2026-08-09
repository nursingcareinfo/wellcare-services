# Patient Edit & Equipment Rental — Design

**Date:** 2026-06-18
**Project:** HMSP Dashboard
**Status:** Approved

## Overview

Two enhancements to the Patient View:
1. Enable editing existing patient info and service details
2. Add equipment rental tracking with full history

---

## 1. Patient Edit Modal

### UX
- Each patient card gets an Edit button (pencil icon) near the patient name header
- Click opens a modal overlay matching the existing "Register Patient" form style
- All fields pre-populated with current values
- Fields editable: full_name, cnic, contact, gender, district, address, service_type (24hr/12hr/8hr), billing_rate, status (Active/Pending/Completed/Cancelled)
- "Save Changes" button updates DB via `updatePatient()`

### Backend
- Add `updatePatient(id, data)` to `patientService.ts`
  - Calls `supabase.from('patients').update(data).eq('id', id)`
- No new DB migration needed — uses existing `patients` table

---

## 2. Equipment Rental — Database

### New Table: `patient_equipment`

```sql
CREATE TABLE patient_equipment (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id),
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
```

- Each row = one equipment item assignment
- `returned_at` is NULL while actively rented
- Returned items stay in the table for history, with `returned_at` set and `status = 'returned'`

---

## 3. Equipment Rental — UI

### Placement
Collapsible section on each patient card, inserted between **Invoices** and **action buttons (Financial Ledger / Manage Case)**.

### Collapsed State
```
▸ Equipment Rentals — 🛏️ 2 items rented — PKR 8,500/mo
```

### Expanded State
| Item | Qty | Rate | Period | Rented | Status |
|------|-----|------|--------|--------|--------|
| Hospital Bed | 1 | 5,000 | monthly | 2026-06-01 | 🟢 Rented |
| Wheelchair | 1 | 3,500 | monthly | 2026-06-10 | 🟢 Rented |
| Oxygen Concentrator | 1 | 7,000 | monthly | 2026-05-01 | ⚪ Returned 2026-06-15 |

### Actions
- **+ Add Equipment** button → inline form: item_name, quantity, rental_rate, rate_period, rented_at
- **Return** button on each rented item → sets `returned_at = today`, `status = 'returned'`, refreshes list
- Returned items shown muted with return date

---

## 4. Backend — Equipment Service

Add to `patientService.ts` or new `equipmentService.ts`:

```typescript
export const equipmentService = {
  async getForPatient(patientId: string) {
    supabase.from('patient_equipment').select('*').eq('patient_id', patientId).order('rented_at', { ascending: false })
  },
  async addItem(data) {
    supabase.from('patient_equipment').insert([data]).select().single()
  },
  async markReturned(id: string) {
    supabase.from('patient_equipment').update({ returned_at: new Date().toISOString().split('T')[0], status: 'returned' }).eq('id', id)
  },
  async deleteItem(id: string) { /* optional */ }
}
```

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/components/PatientView.tsx` | Add Edit modal, Equipment section, new state variables |
| `src/services/patientService.ts` | Add `updatePatient()`, `equipmentService` |
| `supabase/migrations/` | New migration for `patient_equipment` table + RLS |

---

## 6. Not In Scope

- Equipment inventory management (stock tracking, procurement)
- Automated equipment billing tied to invoices
- Separate equipment rental view/route
