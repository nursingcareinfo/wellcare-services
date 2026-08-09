# Staff Financial Ledger — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-staff financial ledger modal showing advance payments, completed shifts, and payroll history. Enhance the advance modal with payment method selection.

**Architecture:** One new component (`StaffLedgerModal`), two new service methods, one new service file. No DB schema changes — all data lives in existing tables (`salary_advances`, `manual_shifts`, `payroll`). The modal loads data via 3 parallel Supabase queries and renders a chronological timeline with summary cards.

**Tech Stack:** React 19, TypeScript, Supabase, TailwindCSS 4, lucide-react, motion

**Design doc:** `docs/plans/2026-06-17-staff-ledger-design.md`

---

### Task 1: Add `getShiftsByEmployee` to shiftService

**Files:**
- Modify: `src/services/shiftService.ts`

**Step 1: Read current shiftService**

```
cat src/services/shiftService.ts
```

**Step 2: Add method**

Add after existing methods:

```typescript
async getShiftsByEmployee(employeeId: string) {
  const { data, error } = await supabase
    .from('manual_shifts')
    .select('*')
    .eq('employee_id', employeeId)
    .order('shift_date', { ascending: false })

  if (error) throw error
  return data as any[]
}
```

`manual_shifts` columns: id, employee_id, patient_id, shift_date, shift_type, decided_rate_pkr, attendance_status, penalty_applied, created_at.

**Step 3: Verify no type errors**

```
npm run lint
```

**Step 4: Commit**

```
git add src/services/shiftService.ts
git commit -m "feat: add getShiftsByEmployee to shiftService"
```

---

### Task 2: Create payrollService

**Files:**
- Create: `src/services/payrollService.ts`

**Step 1: Create file**

```typescript
import { supabase } from '../lib/supabase'

export interface PayrollRecord {
  id: string
  staff_id: string
  staff_name: string
  period_start: string
  period_end: string
  shifts_worked: number
  shift_rate: number
  base_salary: number
  allowances: any
  deductions: any
  deductions_advances: any
  net_salary: number
  status: string
  payment_date: string | null
  created_at: string
}

export const payrollService = {
  async getByEmployee(staffId: string) {
    const { data, error } = await supabase
      .from('payroll')
      .select('*')
      .eq('staff_id', staffId)
      .order('period_start', { ascending: false })

    if (error) throw error
    return data as PayrollRecord[]
  },
}
```

**Step 2: Verify no type errors**

```
npm run lint
```

**Step 3: Commit**

```
git add src/services/payrollService.ts
git commit -m "feat: create payrollService with getByEmployee"
```

---

### Task 3: Enhance advance modal in StaffView with payment method

**Files:**
- Modify: `src/components/StaffView.tsx`

**Step 1: Read StaffView.tsx (focus on advance modal area ~line 906-968)**

**Step 2: Add state variables**

```typescript
const [paymentMethod, setPaymentMethod] = useState<string>('Cash')
const [recentAdvances, setRecentAdvances] = useState<any[]>([])
```

**Step 3: Add payment method dropdown** after the amount input (after line 945)

```tsx
<p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2 mt-4">
  Payment Method
</p>
<select
  value={paymentMethod}
  onChange={(e) => setPaymentMethod(e.target.value)}
  className="w-full bg-slate-800 border border-white/10 rounded-xl py-3 px-4 text-white font-mono focus:border-emerald-500 outline-none"
>
  <option value="Cash">Cash</option>
  <option value="JazzCash">JazzCash</option>
  <option value="EasyPesa">EasyPesa</option>
  <option value="Bank">Bank Transfer</option>
</select>
```

**Step 4: Update handleGiveAdvance** — replace hardcoded payment method

Change `payment_method: 'Cash'` to `payment_method: paymentMethod as 'Cash' | 'JazzCash' | 'EasyPesa' | 'Bank'`

**Step 5: Add recent advances fetch** in `selectedStaffForAdvance` useEffect

When the modal opens, fetch last 3 advances for this staff and display them in a small list.

**Step 6: Verify no type errors**

```
npm run lint
```

**Step 7: Commit**

```
git add src/components/StaffView.tsx
git commit -m "feat: enhance advance modal with payment method and recent history"
```

---

### Task 4: Create StaffLedgerModal component

**Files:**
- Create: `src/components/StaffLedgerModal.tsx`

**Step 1: Create component**

Props: `{ staff: any; onClose: () => void }`

Loads 3 data sources in parallel on mount via `Promise.all`:
1. `advanceService.getAdvancesByEmployee(staff.id)`
2. `shiftService.getShiftsByEmployee(staff.id)`
3. `payrollService.getByEmployee(staff.id)`

Layout:
- Header: avatar initial, name, emp_no, category, close button
- Summary row: 3 cards — Total Earnings (green), Total Advances (amber), Net Balance (white)
- Timeline: merged+ sorted list of all events, each with icon + description + amount + status pill

Timeline event types:

| Type | Icon | Description | Amount | Status |
|---|---|---|---|---|
| Shift | Briefcase (blue) | `{shift_type} shift — {patient_id}` | `Rs. {decided_rate_pkr}` | `attendance_status` |
| Advance | Banknote (amber) | `Advance — {payment_method}` | `Rs. {amount_pkr}` | `status` |
| Payroll | Receipt (emerald) | `Payout — {period_start} to {period_end}` | `Rs. {net_salary}` | `status` |

Empty state: "No financial history recorded for this staff member."

**Step 2: Verify no type errors**

```
npm run lint
```

**Step 3: Commit**

```
git add src/components/StaffLedgerModal.tsx
git commit -m "feat: create StaffLedgerModal component"
```

---

### Task 5: Wire StaffLedgerModal into StaffView

**Files:**
- Modify: `src/components/StaffView.tsx`

**Step 1: Add imports**

```typescript
import StaffLedgerModal from './StaffLedgerModal'
import { Receipt } from 'lucide-react'
```

**Step 2: Add state**

```typescript
const [selectedStaffForLedger, setSelectedStaffForLedger] = useState<any | null>(null)
```

**Step 3: Add "Ledger" button** in each staff card's action buttons (next to Attendance button)

```tsx
<button
  onClick={() => setSelectedStaffForLedger(staff)}
  className="flex items-center gap-1 px-2 py-1 text-[9px] font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-all"
  title="View Financial Ledger"
>
  <Receipt size={12} />
  <span>Ledger</span>
</button>
```

**Step 4: Render modal at component bottom** near advance modal

```tsx
{selectedStaffForLedger && (
  <StaffLedgerModal
    staff={selectedStaffForLedger}
    onClose={() => setSelectedStaffForLedger(null)}
  />
)}
```

**Step 5: Verify no type errors**

```
npm run lint
```

**Step 6: Commit**

```
git add src/components/StaffView.tsx
git commit -m "feat: wire StaffLedgerModal into StaffView"
```

---

### Task 6: Build and deploy

**Step 1: Build**

```
npm run build
```

Expected: clean exit, `dist/` populated.

**Step 2: Push**

```
git push origin main
```

---

## Execution Options

Plan complete. Two ways to execute:

1. **Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** — Open new worktree session with executing-plans skill

Which approach?
