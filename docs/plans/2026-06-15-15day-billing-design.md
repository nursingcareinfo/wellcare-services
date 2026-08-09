# 15-Day Billing & Auto Invoice Design

**Date:** 2026-06-15
**Status:** Design Approved

## Overview

Replace monthly billing with 15-day billing cycles for all active patients. Auto-generate invoices on fixed calendar dates (1st and 16th) using lazy generation triggered on dashboard load. Display invoice history as an expandable section on each patient card.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Billing model | 15-day cycles replace monthly (monthly rate / 2 per cycle) |
| Invoice trigger | Lazy auto-generation on page load (no cron) |
| Periods | Fixed calendar: 1st-15th, 16th-EOM |
| Mid-period starts | Full half-month amount (no proration) |
| Auto-finalize | Invoices generated as "Unpaid" automatically |
| Invoice detail | Basic: patient info, period, service type, amount, status |
| Display | Expandable section on each patient card |

## Database

### New Table: `patient_invoices`

```sql
create table patient_invoices (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid references patients(id) not null,
  period_start date not null,                         -- e.g. 2026-06-01
  period_end   date not null,                         -- e.g. 2026-06-15
  amount       numeric(10,2) not null,                -- billing_rate / 2
  status       text not null default 'Unpaid',        -- Unpaid, Paid, Cancelled
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz default now(),
  unique(patient_id, period_start, period_end)
);
```

**Constraints:**
- `unique(patient_id, period_start, period_end)` — one invoice per period per patient
- `amount` = patient's current `billing_rate / 2` captured at generation time
- RLS: authenticated users can SELECT/INSERT/UPDATE; no DELETE needed

## Auto-Generation Logic

Triggered by a `useEffect` in `PatientView.tsx` on mount:

1. Determine current 15-day period:
   - Day 1-15 → period_start=1st, period_end=15th
   - Day 16-31 → period_start=16th, period_end=last_day_of_month
2. Check if invoices already exist for this period (idempotent check)
3. If not, fetch all patients with `status = 'Active'`
4. For each patient: `amount = billing_rate / 2`
5. Batch insert into `patient_invoices`
6. Reload invoice data

**Edge cases:**
- No active patients → skip silently
- Already generated → skip (unique constraint prevents duplicates)
- Patient deactivated mid-period → no future invoices generated
- Billing rate changes mid-period → rate at generation time is used

## UI Components

### Changes to `PatientView.tsx`

Add expandable invoice section to each patient card:

**Collapsed header:**
```
▼ Invoices (N) — Outstanding: PKR X,XXX   [Generate Invoice]
```

**Expanded body (table):**

| Period | Amount | Status | Actions |
|--------|--------|--------|---------|
| Jun 16-30 | PKR 15,000 | Unpaid | [Mark Paid] |
| Jun 1-15 | PKR 15,000 | Paid ✓ | — |

- **Unpaid** badge → amber/red with pulse effect
- **Paid** badge → emerald with checkmark + paid_at date
- **Mark Paid** button → fires UPDATE `status='Paid', paid_at=now()`
- **Generate Invoice** button → manual override, creates invoice for current period

## Data Flow

```
Page Load → useEffect
  → Determine current 15-day period
  → Check if invoices exist for this period
  → If missing: SELECT active patients → INSERT invoices
  → Fetch all invoices for displayed patients
  → Render expandable sections

Mark Paid → onClick
  → UPDATE patient_invoices SET status='Paid', paid_at=now()
  → Re-fetch patient invoices
  → Re-render

Generate Invoice (manual) → onClick
  → INSERT invoice for current period (handles unique violation gracefully)
  → Re-fetch
```

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/..._patient_invoices.sql` | New migration for table |
| `src/services/patientService.ts` | Add invoice CRUD methods |
| `src/types.ts` | Add `PatientInvoice` interface |
| `src/components/PatientView.tsx` | Add auto-generation effect + expandable invoice section |

## Implementation Order

1. Database migration (patient_invoices table)
2. TypeScript types + patientService invoice methods
3. Auto-generation logic (useEffect in PatientView)
4. Expandable invoice section UI
5. Mark Paid + Generate Invoice buttons
6. Build verification + commit
