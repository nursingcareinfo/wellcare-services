# Salary Period & Paid/Unpaid Day Tracking

**Date:** 2026-06-16
**Status:** Design approved, pending implementation

## Problem

Attendance tracking uses calendar-month cycles (1st–30th), but salary is
calculated over two periods per month: 1st–15th and 16th–end-of-month. Each
day needs to be classified as "paid" (counts toward salary) or "unpaid"
(does not).

## Design

### Approach: Implicit Paid/Unpaid + Period-aware Calendar

No DB schema changes. Paid/unpaid status is derived from existing attendance
status values.

### Period Logic

- **Period 1:** 1st → 15th of month
- **Period 2:** 16th → last day of month
- Active period on modal open:
  - Today ≤ 15th → Period 1
  - Today ≥ 16th → Period 2
- Navigation arrows cycle between periods (not months):
  - Left: previous period (e.g., `Jun 16–30` ← `Jun 1–15`)
  - Right: next period

### Calendar Display

- Grid still shows the **full month** (all 28–31 days) for spatial context
- **Days outside the active period** are dimmed (`opacity-30`, no hover/click)
- **Days inside the active period** behave exactly as current implementation
- Header shows the period range: `"Jun 1 — 15, 2026"` or `"Jun 16 — 30, 2026"`

### Paid/Unpaid Mapping (Implicit from Status)

| Status     | Paid?                     |
|------------|---------------------------|
| Day        | ✅ Paid (full rate)       |
| Night      | ✅ Paid (full rate)       |
| Late       | ✅ Paid (full rate)       |
| Half-Day   | ✅ Paid (half rate)       |
| Absent     | ❌ Unpaid                 |
| Unmarked   | ❌ Unpaid                 |

No changes to the status cycle or DB rows.

### Summary Display

Current:
```
6 day  0 late  0 absent    Rs 7,000
```

New:
```
6 paid  0 unpaid    Rs 7,000
```

- **paid** = Day + Night + Late + Half-Day×0.5 (within active period)
- **unpaid** = Absent + Unmarked days (within active period)
- **Rs** = salary for paid days only (same calculation as current)

### Changes Required

| Layer | Change |
|-------|--------|
| **Service** | New `getStaffCycleAttendance(employeeId, startDate, endDate)` |
| **Service** | Keep `getStaffMonthAttendance` for backward compat |
| **Modal** | Replace month-based state with period-based state |
| **Modal** | Add period detection & navigation logic |
| **Modal** | Update header to show period range |
| **Modal** | Dim days outside active period |
| **Modal** | Filter summary to active period days |
| **Modal** | Rename summary labels: "day" → "paid", "absent" → "unpaid" |

### What Does NOT Change

- DB schema (`staff_attendance` table)
- Attendance status values or cycle logic
- Status color scheme
- Rate calculations
- StaffView integration
- Props passed to modal
