# HMSP Dashboard UI & Feature Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve UI consistency, add type safety, replace alerts with toasts, and add WhatsApp, Shift, Finance, and Matchmaker features.

**Architecture:** Incremental enhancement — fix foundation first (types, toasts, error boundaries), then polish UI views, then add new features. Each phase builds on the previous without breaking existing functionality.

**Tech Stack:** React 19, TypeScript 5.8, TailwindCSS 4, motion, lucide-react, Recharts, Supabase JS client

---

## Phase 1: Foundation — Types, Toast, Error Boundary

### Task 1: Expand Type Definitions

**Files:**

- Modify: `src/types.ts`

**Step 1: Read current types.ts**

```bash
cat src/types.ts
```

**Step 2: Replace/augment with full interfaces**

```typescript
export interface Employee {
  id: string
  emp_no: string
  full_name: string
  cnic_number: string
  phone_primary: string
  district: string
  category: string
  position_applied: string
  experience_years: number
  expected_salary_pkr: number
  is_active: boolean
  is_available: boolean
  is_verified?: boolean
  rating: number
  dob?: string
  religion?: string
  father_husband_name?: string
  marital_status?: string
  skills?: string[]
  relative_info?: { name: string; phone: string; relationship: string }
  critical_missing_info: boolean
  created_at?: string
}

export interface Patient {
  id: string
  [key: string]: unknown
}

export interface Shift {
  id: string
  employee_id: string
  patient_id: string
  shift_type: 'Morning' | 'Night'
  status: 'Scheduled' | 'Completed' | 'Abandoned'
  date: string
}

export interface Advance {
  id: string
  employee_id: string
  amount_pkr: number
  payment_method: string
  status: 'Pending' | 'Settled'
  created_at?: string
}

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}
```

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "types: expand Employee, Patient, Shift, Advance, Toast interfaces"
```

---

### Task 2: Create Toast Context & Component

**Files:**

- Create: `src/context/ToastContext.tsx`
- Create: `src/components/Toast.tsx`

**Step 1: Create ToastContext.tsx**

```typescript
import React, { createContext, useContext, useState, useCallback } from 'react'
import { Toast } from '../types'

interface ToastContextType {
  toasts: Toast[]
  addToast: (message: string, variant: Toast['variant']) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, variant: Toast['variant']) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm ${colors[toast.variant]}`}>
      <span className="text-xs font-bold uppercase tracking-widest">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="ml-2 opacity-50 hover:opacity-100">✕</button>
    </div>
  )
}
```

**Step 2: Wrap App with ToastProvider**

Modify `src/main.tsx`:

```typescript
import { ToastProvider } from './context/ToastContext'

// Wrap <App /> with <ToastProvider>
```

**Step 3: Commit**

```bash
git add src/context/ToastContext.tsx src/main.tsx
git commit -m "feat: add toast notification system with context provider"
```

---

### Task 3: Create Error Boundary

**Files:**

- Create: `src/components/ErrorBoundary.tsx`

**Step 1: Create component**

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="glass-card p-12 text-center">
          <p className="text-red-400 font-bold text-sm">Something went wrong</p>
          <p className="text-slate-500 text-xs mt-2">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-secondary mt-4"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

**Step 2: Wrap each view in App.tsx with ErrorBoundary**

```typescript
{activeView === 'dashboard' && <ErrorBoundary><DashboardView /></ErrorBoundary>}
// ... repeat for each view
```

**Step 3: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/App.tsx
git commit -m "feat: add ErrorBoundary wrapper for all views"
```

---

### Task 4: Replace alert() with useToast() in StaffView

**Files:**

- Modify: `src/components/StaffView.tsx`

**Step 1: Import and replace**

```typescript
import { useToast } from '../context/ToastContext'

// Inside component:
const { addToast } = useToast()

// Replace all alert() calls:
// alert('Staff registered successfully!') → addToast('Staff registered successfully', 'success')
// alert(`Registration failed: ${error.message}`) → addToast('Registration failed', 'error')
// Same pattern for advance, edit, delete operations
```

**Step 2: Commit**

```bash
git add src/components/StaffView.tsx
git commit -m "refactor: replace alert() with toast notifications in StaffView"
```

---

### Task 5: Run build to verify Phase 1

**Step 1: Type check**

```bash
npm run lint
```

**Step 2: Build**

```bash
npm run build
```

**Step 3: If clean, commit final Phase 1 tag**

```bash
git commit --allow-empty -m "phase-1: foundation complete — types, toasts, error boundaries"
```

---

## Phase 2: UI Polish

### Task 6: Dashboard — Real Trends + Today's Shifts Card

**Files:**

- Modify: `src/components/DashboardView.tsx`

**Step 1: Calculate real trends**

Query previous period data from Supabase and compare:

```typescript
// Instead of hardcoded '+2%', calculate:
const previousAvg = ... // query last 30 days average
const currentCount = activeStaff
const trend = currentCount > previousAvg ? '+' : ''
const trendPct = Math.round(((currentCount - previousAvg) / previousAvg) * 100)
```

**Step 2: Add "Today's Shifts" card**

```typescript
// Query manual_shifts where date = today
// Show count of Morning/Night shifts, completed vs scheduled
```

Add card to the stats grid:

```tsx
<div className="bg-slate-900/40 border border-white/5 rounded-xl p-5">
  <p className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Today's Shifts</p>
  <div className="flex gap-4 mt-3">
    <div className="text-center">
      <div className="text-2xl font-mono font-bold text-blue-400">{morningCount}</div>
      <div className="text-[9px] text-slate-500 uppercase">Morning</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-mono font-bold text-purple-400">{nightCount}</div>
      <div className="text-[9px] text-slate-500 uppercase">Night</div>
    </div>
  </div>
</div>
```

**Step 3: Make chart interactive**

```tsx
<Bar dataKey="total" radius={[4, 4, 0, 0]} onClick={(data) => {
  // Navigate to StaffView with category filter
}}>
```

**Step 4: Commit**

```bash
git add src/components/DashboardView.tsx
git commit -m "feat: dashboard real trends, today's shifts card, interactive chart"
```

---

### Task 7: Staff Cards Redesign

**Files:**

- Modify: `src/components/StaffView.tsx`

**Step 1: Restructure card layout**

Replace current card structure with cleaner hierarchy:

- Header: Avatar (larger, gradient) + Name + Position badge
- Body: Location + Salary + Rating + Availability toggle (inline)
- Collapsible details: `<details>` element with religion, age, family info
- Footer: Skills + Edit/Delete/Advance buttons

**Step 2: Reduce visual noise**

- Remove excessive borders
- Increase whitespace between sections
- Use `gap-4` instead of `gap-2` for breathing room

**Step 3: Commit**

```bash
git add src/components/StaffView.tsx
git commit -m "ui: redesign staff cards with cleaner hierarchy"
```

---

### Task 8: Global UI Consistency

**Files:**

- Modify: `src/index.css`
- Modify: All view components

**Step 1: Add CSS utilities**

```css
.section-header {
  @apply text-xs font-black uppercase tracking-[0.2em] text-slate-400;
}
.card {
  @apply bg-slate-900/40 border border-white/5 rounded-xl p-6;
}
.loading-state {
  @apply flex flex-col items-center justify-center h-64 space-y-4;
}
```

**Step 2: Apply consistently across all views**

Replace ad-hoc classes with `.section-header`, `.card`, `.loading-state`.

**Step 3: Mobile nav improvements**

In `App.tsx`, change:

```tsx
<span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
```

**Step 4: Commit**

```bash
git add src/index.css src/App.tsx src/components/*.tsx
git commit -m "ui: global consistency — standardized headings, cards, loading states"
```

---

## Phase 3: New Features

### Task 9: WhatsApp Analytics View

**Files:**

- Create: `src/components/WhatsAppView.tsx`
- Modify: `src/App.tsx`

**Step 1: Create component with mock data**

```tsx
export default function WhatsAppView() {
  const mockStats = { sent: 1240, delivered: 1180, read: 890 }
  const labels = ['Staff', 'Patient', 'Lead', 'Inactive']
  const templates = [
    { id: 1, name: 'Welcome Message', body: 'Welcome to HMSP...' },
    { id: 2, name: 'Shift Reminder', body: 'Your shift starts at...' },
  ]

  return (
    <div className="space-y-8">
      {/* Stats cards */}
      {/* Labels section */}
      {/* Quick-reply templates */}
      <div className="glass-card p-8 text-center opacity-50">
        <p className="text-xs text-slate-500">WhatsApp API integration coming in Phase 2</p>
      </div>
    </div>
  )
}
```

**Step 2: Register in App.tsx**

Add `'whatsapp'` to View type and menuItems. Replace stub with `<WhatsAppView />`.

**Step 3: Commit**

```bash
git add src/components/WhatsAppView.tsx src/App.tsx
git commit -m "feat: add WhatsApp Analytics view with mock data structure"
```

---

### Task 10: Shift Conflict Detection

**Files:**

- Modify: `src/services/shiftService.ts`
- Modify: `src/components/CalendarView.tsx`

**Step 1: Add conflict detection to shiftService**

```typescript
function checkConflicts(newShift: Shift, existingShifts: Shift[]): string[] {
  const conflicts: string[] = []
  for (const shift of existingShifts) {
    if (shift.employee_id === newShift.employee_id && shift.date === newShift.date) {
      conflicts.push(`Conflict: ${shift.employee_id} already assigned on ${shift.date}`)
    }
  }
  return conflicts
}
```

**Step 2: Show conflicts in CalendarView**

When assigning shifts, display warning toast if conflicts detected.

**Step 3: Commit**

```bash
git add src/services/shiftService.ts src/components/CalendarView.tsx
git commit -m "feat: shift conflict detection with warning toasts"
```

---

### Task 11: Finance View — CSV Export + Payout Summary

**Files:**

- Modify: `src/components/FinanceView.tsx`

**Step 1: Add CSV export function**

```typescript
function exportToCSV(data: any[], filename: string) {
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map((row) => Object.values(row).join(','))
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}
```

**Step 2: Add payout summary table**

Query `salary_advances` + `employees` to show monthly breakdown.

**Step 3: Commit**

```bash
git add src/components/FinanceView.tsx
git commit -m "feat: finance CSV export and monthly payout summary"
```

---

### Task 12: Matchmaker AI Boost

**Files:**

- Modify: `src/components/MatchmakerView.tsx`
- Modify: `src/services/geminiService.ts`

**Step 1: Enhance Gemini prompt**

```typescript
// Add to geminiService:
async function matchStaffToPatient(
  patient: Patient,
  staff: Employee[]
): Promise<{ employee: Employee; score: number; reason: string }[]> {
  const prompt = `Match this patient to available staff considering:
  - Patient location: ${patient.district}
  - Required skills: ${patient.needs}
  - Available staff: ${staff.map((s) => `${s.full_name} (${s.category}, ${s.district}, skills: ${s.skills?.join(', ')})`).join('; ')}
  Return top 3 matches with score (0-100) and reasoning.`

  // Parse Gemini response into structured matches
}
```

**Step 2: Display match scores in UI**

```tsx
{
  matches.map((match, i) => (
    <div key={match.employee.id} className="card flex justify-between items-center">
      <div>
        <span className="text-sm font-bold text-white">{match.employee.full_name}</span>
        <p className="text-xs text-slate-500">{match.reason}</p>
      </div>
      <div className="text-2xl font-mono font-bold text-emerald-400">{match.score}%</div>
    </div>
  ))
}
```

**Step 3: Commit**

```bash
git add src/components/MatchmakerView.tsx src/services/geminiService.ts
git commit -m "feat: AI-powered patient-staff matching with Gemini scores"
```

---

### Task 13: Final Verification & Build

**Step 1: Type check**

```bash
npm run lint
```

**Step 2: Build**

```bash
npm run build
```

**Step 3: Verify zero `any[]` in components**

```bash
grep -rn "any\[\]" src/components/ || echo "Clean: no any[] found"
```

**Step 4: Verify zero `alert()` calls**

```bash
grep -rn "alert(" src/ || echo "Clean: no alert() found"
```

**Step 5: Commit**

```bash
git commit --allow-empty -m "phase-3: all features complete, verified build"
```
