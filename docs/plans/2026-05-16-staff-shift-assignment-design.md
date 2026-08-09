# Staff Shift Assignment — Design Doc

**Date:** 2026-05-16
**Status:** Draft
**Feature:** Inline shift assignment from Staff cards + Patient cards

---

## Problem

Staff cards show "ON DUTY" but there's no way to assign a patient/shift from the UI. The CalendarView has a dead "Log New Manual Override" button. PatientView has placeholder assignment slots. Users need to create shifts (Morning/Night) with patient assignment and per-shift rate directly from the card interface.

---

## Design

### 1. Staff Card — "On Duty" Toggle Flow

**Available → On Duty:**

1. Click availability toggle on staff card
2. Inline panel expands below the toggle with:
   - **Patient dropdown**: Lists active patients who don't already have a staff assigned for the selected shift type today
   - **Shift type radio**: Morning / Night
   - **Rate input**: Pre-filled with `staff.expected_salary_pkr`, editable
   - **Assign button**: Creates `manual_shifts` record
3. On success:
   - Panel collapses
   - Badge changes to "ON DUTY" (amber)
   - Shows: Shift type, Patient name, Rate
   - Staff `is_available` set to `false`

**On Duty → Available (Unassign):**

1. Click "ON DUTY" badge
2. Inline panel shows current assignment details + "Remove Assignment" button
3. On confirm:
   - Deletes today's `manual_shifts` record for this staff
   - Staff `is_available` set to `true`
   - Badge reverts to "AVAILABLE" (green)

### 2. Card Display States

**Available:**

```
[AVAILABLE]  (green badge)
```

**On Duty:**

```
[ON DUTY ▼]
Morning Shift
Patient: Fatima Bibi
Rate: PKR 2,500/shift
```

### 3. Patient Card Integration

**PatientView changes:**

- Each patient card shows today's assigned staff for Morning/Night slots
- "Assign Staff" button opens staff picker (filters to available staff)
- Shows assigned staff name + shift type + rate directly on card
- Uses same `manual_shifts` table — single source of truth

### 4. Data Flow

```
StaffView toggle
  → shiftService.createShift({ employee_id, patient_id, shift_date, shift_type, decided_rate_pkr })
  → Supabase insert into manual_shifts
  → Refresh staff list (re-fetches assignments)

PatientView card
  ← shiftService.getTodayShifts()
  ← Supabase query: SELECT * FROM manual_shifts WHERE shift_date = TODAY
  ← Join with employees and patients tables
```

### 5. Constraints & Validation

- **Unique constraint**: `UNIQUE(employee_id, shift_date, shift_type)` prevents double-booking
- **Patient availability**: Dropdown filters out patients who already have a staff for the selected shift type today
- **Staff availability**: Only available staff can be assigned; assigning sets `is_available = false`
- **Rate validation**: Must be > 0
- **Date**: Always today (no future/past assignment from card — use CalendarView for that)

### 6. Files Affected

| File                             | Change                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `src/services/shiftService.ts`   | Add `createShift()`, `deleteShift()`, `getTodayShifts()`  |
| `src/components/StaffView.tsx`   | Inline assignment panel, toggle logic, display shift info |
| `src/components/PatientView.tsx` | Show assigned staff, assign staff button                  |
| `src/types.ts`                   | Add `ShiftAssignment` type if needed                      |

---

## Success Criteria

- [ ] Clicking toggle on available staff opens assignment panel
- [ ] Patient dropdown shows only patients needing that shift today
- [ ] Rate defaults to staff's expected salary, editable
- [ ] Assign creates `manual_shifts` record correctly
- [ ] Card shows shift type, patient name, rate when on duty
- [ ] Clicking "ON DUTY" allows unassignment
- [ ] Unassign deletes shift record and restores availability
- [ ] PatientView shows assigned staff per shift slot
- [ ] No double-booking possible (DB constraint + UI filtering)
