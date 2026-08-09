# 15-Day Billing & Auto Invoice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace monthly billing with auto-generated 15-day invoices, viewable as an expandable section on each patient card.

**Architecture:** New `patient_invoices` table stores invoice records. A `useEffect` in `PatientView.tsx` checks for and generates missing invoices on page load (lazy auto-generation). The expandable invoice section lives within each patient card and supports Mark Paid / Generate Invoice actions.

**Tech Stack:** Supabase (Postgres migration), React 19, TypeScript, TailwindCSS 4, lucide-react icons

**Design Doc:** `docs/plans/2026-06-15-15day-billing-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: (run via Supabase migration tool)

**Step 1: Run migration**

```bash
supabase migration new patient_invoices
```

Replace the generated file with:

```sql
create table patient_invoices (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid references patients(id) not null on delete cascade,
  period_start date not null,
  period_end   date not null,
  amount       numeric(10,2) not null,
  status       text not null default 'Unpaid' check (status in ('Unpaid', 'Paid', 'Cancelled')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz default now(),
  unique(patient_id, period_start, period_end)
);

-- Allow read for authenticated users
alter table patient_invoices enable row level security;

create policy "Authenticated users can read invoices"
  on patient_invoices for select
  to authenticated
  using (true);

create policy "Authenticated users can insert invoices"
  on patient_invoices for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update invoices"
  on patient_invoices for update
  to authenticated
  using (true)
  with check (true);
```

**Step 2: Apply migration**

Run: `supabase db push` or apply via the Supabase dashboard SQL editor.

**Step 3: Verify**

Run: `supabase db diff` — confirm patient_invoices table exists.

**Step 4: Commit**

```bash
git add supabase/migrations/<timestamp>_patient_invoices.sql
git commit -m "feat(db): add patient_invoices table for 15-day billing"
```

---

### Task 2: TypeScript Types + Service Methods

**Files:**
- Modify: `src/types.ts`
- Modify: `src/services/patientService.ts`

**Step 1: Add TypeScript interface**

In `src/types.ts`, add after the `Patient` interface:

```typescript
export interface PatientInvoice {
  id: string
  patient_id: string
  period_start: string
  period_end: string
  amount: number
  status: 'Unpaid' | 'Paid' | 'Cancelled'
  paid_at: string | null
  notes: string | null
  created_at: string
}
```

**Step 2: Add invoice CRUD methods to patientService**

In `src/services/patientService.ts`, add:

```typescript
export const patientInvoiceService = {
  async getInvoicesForPatient(patientId: string) {
    const { data, error } = await supabase
      .from('patient_invoices')
      .select('*')
      .eq('patient_id', patientId)
      .order('period_start', { ascending: false })

    if (error) throw error
    return data as PatientInvoice[]
  },

  async getInvoicesForPatients(patientIds: string[]) {
    const { data, error } = await supabase
      .from('patient_invoices')
      .select('*')
      .in('patient_id', patientIds)
      .order('period_start', { ascending: false })

    if (error) throw error
    return data as PatientInvoice[]
  },

  async generateInvoice(patientId: string, patientBillingRate: number) {
    const { periodStart, periodEnd } = getCurrentPeriod()
    const amount = patientBillingRate / 2

    const { data, error } = await supabase
      .from('patient_invoices')
      .insert([{
        patient_id: patientId,
        period_start: periodStart,
        period_end: periodEnd,
        amount,
      }])
      .select()
      .single()

    if (error) throw error
    return data as PatientInvoice
  },

  async markAsPaid(invoiceId: string) {
    const { data, error } = await supabase
      .from('patient_invoices')
      .update({ status: 'Paid', paid_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .select()
      .single()

    if (error) throw error
    return data as PatientInvoice
  },
}

export function getCurrentPeriod() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  if (day <= 15) {
    return {
      periodStart: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      periodEnd: `${year}-${String(month + 1).padStart(2, '0')}-15`,
    }
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate()
    return {
      periodStart: `${year}-${String(month + 1).padStart(2, '0')}-16`,
      periodEnd: `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`,
    }
  }
}
```

**Step 3: Also export PatientInvoice from types.ts index**

Ensure `PatientInvoice` is exported from `src/types.ts`.

**Step 4: LspDiagnostics verification**

Run: `lsp_diagnostics src/types.ts src/services/patientService.ts`
Expected: clean (no errors).

**Step 5: Commit**

```bash
git add src/types.ts src/services/patientService.ts
git commit -m "feat: add PatientInvoice types and service methods"
```

---

### Task 3: Auto-Generation Effect + Invoice UI in PatientView

**Files:**
- Modify: `src/components/PatientView.tsx`

**Step 1: Add imports**

Add to the import block:
```typescript
import { PatientInvoice } from '../types'
import { patientInvoiceService, getCurrentPeriod } from '../services/patientService'
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Receipt } from 'lucide-react'
```

**Step 2: Add state variables**

Inside the `PatientView` component, add:
```typescript
const [invoices, setInvoices] = useState<Record<string, PatientInvoice[]>>({})
const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set())
const [generatingPeriods, setGeneratingPeriods] = useState(false)
```

**Step 3: Add auto-generation effect**

Add after the existing `useEffect` for loadPatients:

```typescript
// Auto-generate invoices for current period on mount
useEffect(() => {
  async function autoGenerate() {
    if (patients.length === 0) return
    setGeneratingPeriods(true)
    try {
      const { periodStart } = getCurrentPeriod()
      const activePatients = patients.filter(p => p.status === 'Active')

      for (const patient of activePatients) {
        // Check if invoice already exists for this period
        const existing = await patientInvoiceService.getInvoicesForPatient(patient.id)
        const hasInvoice = existing.some(
          inv => inv.period_start === periodStart
        )
        if (!hasInvoice) {
          await patientInvoiceService.generateInvoice(patient.id, patient.billing_rate)
        }
      }

      // Reload invoices for all patients
      const allIds = patients.map(p => p.id)
      const allInvoices = await patientInvoiceService.getInvoicesForPatients(allIds)
      const grouped: Record<string, PatientInvoice[]> = {}
      for (const inv of allInvoices) {
        if (!grouped[inv.patient_id]) grouped[inv.patient_id] = []
        grouped[inv.patient_id].push(inv)
      }
      setInvoices(grouped)
    } catch (error) {
      console.error('Auto-generate invoices error:', error)
    } finally {
      setGeneratingPeriods(false)
    }
  }
  autoGenerate()
}, [patients.length])
```

Wait — this has a problem. The `patients` dependency with `patients.length` won't work because `patients` is the array, and `.length` changes when patients load. But `patients` itself might cause infinite re-renders if we refer to it as a dependency since it's recreated on each fetch.

Actually, let me restructure: put the auto-generation in the `loadPatients` callback, after the data is fetched. That way it runs once after patients load.

Better approach:

```typescript
const loadPatients = async () => {
  try {
    const data = await patientService.getAllPatients()
    setPatients(data)
    // Auto-generate invoices for current period
    await autoGenerateInvoices(data)
  } catch (error) {
    console.error('Error fetching patients:', error)
  } finally {
    setLoading(false)
  }
}

async function autoGenerateInvoices(patientsList: any[]) {
  const activePatients = patientsList.filter(p => p.status === 'Active')
  if (activePatients.length === 0) return

  const { periodStart } = getCurrentPeriod()

  for (const patient of activePatients) {
    const existing = await patientInvoiceService.getInvoicesForPatient(patient.id)
    const hasInvoice = existing.some(inv => inv.period_start === periodStart)
    if (!hasInvoice) {
      await patientInvoiceService.generateInvoice(patient.id, patient.billing_rate)
    }
  }

  // Reload all invoices
  const allIds = patientsList.map(p => p.id)
  const allInvoices = await patientInvoiceService.getInvoicesForPatients(allIds)
  const grouped: Record<string, PatientInvoice[]> = {}
  for (const inv of allInvoices) {
    if (!grouped[inv.patient_id]) grouped[inv.patient_id] = []
    grouped[inv.patient_id].push(inv)
  }
  setInvoices(grouped)
}
```

**Step 4: Add invoice section to patient card rendering**

In the patient card (inside the `patients.map` loop), add after the assignments section and before the action buttons div:

```tsx
{/* Invoices Section */}
<div className="border-t border-white/5 pt-4 mt-4">
  <button
    onClick={() => {
      const next = new Set(expandedPatients)
      if (next.has(patient.id)) next.delete(patient.id)
      else next.add(patient.id)
      setExpandedPatients(next)
    }}
    className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
  >
    <div className="flex items-center gap-2">
      {expandedPatients.has(patient.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <Receipt size={14} />
      Invoices ({(invoices[patient.id] || []).length})
      {(() => {
        const patientInvs = invoices[patient.id] || []
        const unpaid = patientInvs.find(i => i.status === 'Unpaid')
        return unpaid
          ? <span className="text-amber-400 ml-2">— PKR {unpaid.amount.toLocaleString()} • Unpaid</span>
          : null
      })()}
    </div>
    <button
      onClick={async (e) => {
        e.stopPropagation()
        await patientInvoiceService.generateInvoice(patient.id, patient.billing_rate)
        const refreshed = await patientInvoiceService.getInvoicesForPatient(patient.id)
        setInvoices(prev => ({ ...prev, [patient.id]: refreshed }))
      }}
      className="text-[9px] px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors"
    >
      + Generate Invoice
    </button>
  </button>

  {expandedPatients.has(patient.id) && (
    <div className="mt-3 space-y-1">
      {(invoices[patient.id] || []).length === 0 ? (
        <p className="text-[10px] text-slate-600 italic py-2 text-center">No invoices yet</p>
      ) : (
        (invoices[patient.id] || []).map(inv => (
          <div
            key={inv.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/5 text-[11px]"
          >
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-mono">
                {formatPeriod(inv.period_start, inv.period_end)}
              </span>
              <span className="font-mono font-bold text-emerald-400">
                PKR {inv.amount.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {inv.status === 'Paid' ? (
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                  <CheckCircle2 size={12} /> Paid {inv.paid_at ? format(new Date(inv.paid_at), 'dd-MMM') : ''}
                </span>
              ) : inv.status === 'Cancelled' ? (
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Cancelled
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-400">
                    <Circle size={12} className="fill-amber-400/20" /> Unpaid
                  </span>
                  <button
                    onClick={async () => {
                      await patientInvoiceService.markAsPaid(inv.id)
                      const refreshed = await patientInvoiceService.getInvoicesForPatient(patient.id)
                      setInvoices(prev => ({ ...prev, [patient.id]: refreshed }))
                    }}
                    className="text-[8px] px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors font-black uppercase tracking-widest"
                  >
                    Mark Paid
                  </button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )}
</div>
```

**Step 5: Add helper function**

Add outside the component (or as a utility):
```typescript
function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[s.getMonth()]} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`
}
```

Also need to import `format` from `date-fns` or use our own helper. Since `date-fns` is already in the project, we can do:
```typescript
import { format } from 'date-fns'
```

Wait, actually let me avoid the `format` import and just use our own `formatPeriod` which doesn't need date-fns.

**Step 6: LspDiagnostics verification**

Run: `lsp_diagnostics src/components/PatientView.tsx`
Expected: clean (no errors).

**Step 7: Build verification**

Run: `npm run build`
Expected: builds successfully.

**Step 8: Commit**

```bash
git add src/components/PatientView.tsx
git commit -m "feat: add auto-invoice generation and expandable invoice section to patient cards"
```

---

### Task 4: Final Verification

**Steps:**
1. Run `npm run build` — must pass
2. Run `lsp_diagnostics` on all changed files — must be clean
3. Push to origin/main
4. Verify on live site via Chrome DevTools

---

## Task Dependencies

```
Task 1 (DB migration) → Task 2 (types + service) → Task 3 (UI + auto-gen) → Task 4 (verify)
```

All tasks are sequential — each depends on the previous.
