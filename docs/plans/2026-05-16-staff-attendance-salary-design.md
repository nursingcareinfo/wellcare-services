# Staff Attendance & Salary Calculation — Design Doc

**Date:** 2026-05-16
**Status:** Draft
**Feature:** Dedicated attendance tracking with calendar UI and auto-salary calculation

---

## Problem

Currently, attendance is tracked implicitly via `manual_shifts` (Completed/Abandoned). This conflates shift work with general presence. Staff can be present but not on a shift, or on a shift but marked absent. There's no dedicated way to mark daily attendance (Present/Absent/Late) and calculate salary based on actual days worked.

---

## Design

### 1. Database Schema

**New Table:** `staff_attendance`

```sql
CREATE TABLE staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  attendance_date DATE NOT NULL,
  status TEXT CHECK (status IN ('Present', 'Absent', 'Late', 'Half-Day')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);
```

**Why:**

- Tracks daily status independent of shifts.
- `UNIQUE` constraint prevents double-marking same day.
- Supports `Late` and `Half-Day` for nuanced payroll.

### 2. UI Layout — Attendance Calendar

**View:** New `AttendanceView.tsx` (replaces current stub).

**Layout:**

1.  **Header:** Month/Year selector (e.g., "May 2026") + "Calculate Salary" button.
2.  **Staff List:** Vertical list of all active staff.
3.  **Calendar Grid:**
    - Rows = Staff members.
    - Columns = Days of month (1-30/31).
    - Cells = Clickable status badges.
    - Clicking a cell cycles: `Empty` → `Present` (Green) → `Absent` (Red) → `Late` (Yellow) → `Half-Day` (Blue).
4.  **Summary Row:** Bottom row shows totals per staff:
    - Present: 24 | Absent: 4 | Late: 2
    - Est. Salary: PKR 24,000

**Interaction:**

- Click cell → Updates DB → Refreshes summary.
- "Calculate Salary" → Opens modal with breakdown.

### 3. Salary Calculation Logic

**Formula:**

```
Daily Rate = expected_salary_pkr / 30
Present Days = Count(status = 'Present') + Count(status = 'Half-Day') * 0.5
Late Deduction = Count(status = 'Late') * (Daily Rate * 0.1)  -- 10% penalty per late
Total Salary = (Present Days * Daily Rate) - Late Deduction
```

**Display:**

- Modal shows table: Staff Name | Days Present | Daily Rate | Deductions | Net Pay.
- "Export to CSV" button for accounting.

### 4. Integration with Payouts

**Changes to `FinanceView.tsx`:**

- Add "Attendance Summary" card.
- Pulls data from `staff_attendance` for current month.
- Shows total payroll liability based on attendance.
- Links to `AttendanceView` for detailed marking.

---

## Success Criteria

- [ ] New `staff_attendance` table created with unique constraint.
- [ ] `AttendanceView` shows calendar grid (Staff × Days).
- [ ] Clicking cell cycles status (Present/Absent/Late/Half-Day).
- [ ] Summary row shows totals and estimated salary per staff.
- [ ] "Calculate Salary" modal shows detailed breakdown.
- [ ] Export to CSV works.
- [ ] Finance view shows attendance summary card.
- [ ] Salary formula matches requirements.
