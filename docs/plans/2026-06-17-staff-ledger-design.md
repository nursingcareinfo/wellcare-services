# Staff Financial Ledger — Design

**Date**: 2026-06-17
**Project**: HMSP Dashboard
**Status**: Design approved, pending implementation

## Overview

Add a per-staff financial ledger view showing advance payments, completed shifts, and payroll history in a single timeline. Enhance the existing advance disbursement modal with payment method selection.

## Scope

- **New**: `StaffLedgerModal` — timeline of all financial events per staff member
- **New**: `payrollService` — query payroll records by employee
- **Enhanced**: `advanceService` — accept payment_method parameter
- **Enhanced**: `shiftService` — add getShiftsByEmployee method
- **Enhanced**: Staff card in `StaffView` — add "Ledger" button, wire up modal
- **Enhanced**: Advance modal — add payment method dropdown, show recent advances

## Data Flow

Modal opens → 3 parallel queries:

1. `salary_advances` WHERE employee_id = ? (all advances)
2. `manual_shifts` WHERE employee_id = ? ORDER BY shift_date DESC (all shifts)
3. `payroll` WHERE staff_id = ? ORDER BY period_start DESC (all payouts)

Client-side calculations from returned data:
- Total earnings = SUM(decided_rate_pkr) WHERE attendance_status = 'Completed'
- Total advances = SUM(amount_pkr) WHERE status != 'Settled'
- Net balance = earnings − advances

## Components

### StaffLedgerModal (new)
- Full-screen overlay modal
- Header: staff name, emp_no, category, summary cards (earnings, advances, net)
- Timeline: chronological feed of shifts, advances, payouts
- Each timeline entry: date badge, type icon, description, amount, status pill

### Advance Modal Enhancement (existing)
- Replace hardcoded `payment_method: 'Cash'` with dropdown: Cash | JazzCash | EasyPesa | Bank
- Add "Recent Advances" section showing last 3 advances for context

## Services

| Method | Source |
|---|---|
| `advanceService.addAdvance({...payment_method})` | Existing, enhance signature |
| `shiftService.getShiftsByEmployee(id)` | New |
| `payrollService.getByEmployee(id)` | New file |

## No Schema Changes

All data exists in current tables:
- `salary_advances` — employee_id, amount_pkr, disbursement_date, payment_method, status, notes
- `manual_shifts` — employee_id, shift_date, shift_type, decided_rate_pkr, attendance_status
- `payroll` — staff_id, period_start, period_end, shifts_worked, net_salary, status

## UI Mock

```
┌─────────────────────────────────────────────────┐
│ [X] Staff Ledger — Muhammad Ahmed Khan          │
│ NC-KHI-0001 • R/N • ICU Nurse                   │
│                                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│ │ Earnings │ │ Advances │ │ Net Due  │          │
│ │ Rs 45,000│ │ Rs 8,000 │ │ Rs 37,000│          │
│ └──────────┘ └──────────┘ └──────────┘          │
│                                                  │
│ ── Today ────────────────────────────────────── │
│ │ Advance  │ Rs 5,000 • Cash • Pending     │     │
│ ── Jun 15 ──────────────────────────────────── │
│ │ Shift ☀  │ Day — Mrs. Fatima • Rs 2,500  │     │
│ │          │ Completed                       │     │
│ ── Jun 10 ──────────────────────────────────── │
│ │ Payout   │ Apr 1-30 • Rs 45,000 • Paid    │     │
│ ── Jun 5 ───────────────────────────────────── │
│ │ Advance  │ Rs 3,000 • JazzCash • Settled   │     │
│                                                  │
│ [ Record Advance ]                               │
└─────────────────────────────────────────────────┘
```

## File Changes Summary

| File | Action |
|---|---|
| `src/services/advanceService.ts` | Edit — add payment_method param |
| `src/services/shiftService.ts` | Edit — add getShiftsByEmployee |
| `src/services/payrollService.ts` | Create |
| `src/components/StaffLedgerModal.tsx` | Create |
| `src/components/StaffView.tsx` | Edit — add button + modal |
