# Staff Attendance & Salary Calculation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a dedicated attendance tracking system with calendar UI and auto-salary calculation based on days present.

**Architecture:** New `staff_attendance` table stores daily status (Present/Absent/Late/Half-Day). `AttendanceView` renders a Staff × Days grid. Clicking cells updates status. Salary calculated via formula: `(Present + Half-Day*0.5) * (Salary/30) - LatePenalty`.

**Tech Stack:** React 19, TypeScript, Supabase JS client, TailwindCSS 4, lucide-react

---

### Task 1: Create `staff_attendance` Table Migration

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_create_staff_attendance.sql`

**Step 1: Write migration SQL**

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

ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on staff_attendance" ON staff_attendance FOR ALL USING (true) WITH CHECK (true);
```

**Step 2: Apply migration**

```bash
npx supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "db: add staff_attendance table for daily tracking"
```

---

### Task 2: Create Attendance Service

**Files:**

- Create: `src/services/attendanceService.ts`

**Step 1: Write service methods**

```typescript
import { supabase } from '../lib/supabase'

export interface AttendanceRecord {
  id: string
  employee_id: string
  attendance_date: string
  status: 'Present' | 'Absent' | 'Late' | 'Half-Day'
  notes?: string
}

export const attendanceService = {
  async getMonthAttendance(year: number, month: number) {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (error) throw error
    return data || []
  },

  async upsertAttendance(record: Partial<AttendanceRecord>) {
    const { data, error } = await supabase
      .from('staff_attendance')
      .upsert(record, { onConflict: 'employee_id,attendance_date' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteAttendance(employeeId: string, date: string) {
    const { error } = await supabase
      .from('staff_attendance')
      .delete()
      .eq('employee_id', employeeId)
      .eq('attendance_date', date)

    if (error) throw error
  },
}
```

**Step 2: Commit**

```bash
git add src/services/attendanceService.ts
git commit -m "feat: add attendance service with CRUD operations"
```

---

### Task 3: Create AttendanceView Component

**Files:**

- Create: `src/components/AttendanceView.tsx`

**Step 1: Scaffold component structure**

```tsx
import React, { useState, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Download } from 'lucide-react'
import { attendanceService } from '../services/attendanceService'
import { staffService } from '../services/staffService'
import { cn } from '../lib/utils'

export default function AttendanceView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [staff, setStaff] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => {
    loadData()
  }, [year, month])

  const loadData = async () => {
    setLoading(true)
    try {
      const [staffData, attendanceData] = await Promise.all([
        staffService.getActiveStaff(),
        attendanceService.getMonthAttendance(year, month),
      ])
      setStaff(staffData)
      setAttendance(attendanceData)
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusForStaffDay = (staffId: string, day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0]
    return attendance.find((a) => a.employee_id === staffId && a.attendance_date === dateStr)
      ?.status
  }

  const cycleStatus = async (staffId: string, day: number) => {
    const current = getStatusForStaffDay(staffId, day)
    const cycle = {
      undefined: 'Present',
      Present: 'Absent',
      Absent: 'Late',
      Late: 'Half-Day',
      'Half-Day': undefined,
    }
    const next = cycle[current as keyof typeof cycle]

    const dateStr = new Date(year, month, day).toISOString().split('T')[0]

    if (next) {
      await attendanceService.upsertAttendance({
        employee_id: staffId,
        attendance_date: dateStr,
        status: next,
      })
    } else {
      await attendanceService.deleteAttendance(staffId, dateStr)
    }
    loadData()
  }

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      case 'Absent':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'Late':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      case 'Half-Day':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default:
        return 'bg-white/5 text-slate-600 border-white/10'
    }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900/40 border border-white/5 p-6 rounded-xl">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Calendar className="text-blue-500" /> Attendance Ledger
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">
            Mark daily presence • Auto-calculate payroll
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-white/5 rounded-lg border border-white/5"
          >
            <ChevronLeft size={20} className="text-slate-400" />
          </button>
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-widest w-32 text-center">
            {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-white/5 rounded-lg border border-white/5"
          >
            <ChevronRight size={20} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto bg-slate-900/40 border border-white/5 rounded-xl p-6">
        <div className="min-w-[800px]">
          {/* Header Row */}
          <div className="grid grid-cols-[200px_repeat(31,1fr)] gap-1 mb-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">
              Staff Member
            </div>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <div
                key={i}
                className="text-[8px] text-center font-bold text-slate-600 py-2 border-b border-white/5"
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Staff Rows */}
          {staff.map((s) => (
            <div key={s.id} className="grid grid-cols-[200px_repeat(31,1fr)] gap-1 mb-1">
              <div className="text-[10px] font-bold text-white py-2 truncate pr-2">
                {s.full_name}
              </div>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const status = getStatusForStaffDay(s.id, i + 1)
                return (
                  <button
                    key={i}
                    onClick={() => cycleStatus(s.id, i + 1)}
                    className={cn(
                      'h-8 rounded border text-[8px] font-bold transition-all hover:scale-105',
                      getStatusColor(status)
                    )}
                  >
                    {status?.[0] || ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Register in App.tsx**

```typescript
// Add to imports
import AttendanceView from './components/AttendanceView'

// Update view type
type View = 'dashboard' | 'staff' | 'patients' | 'matchmaker' | 'finance' | 'ocr' | 'attendance' | 'memory'

// Update menuItems
{ id: 'attendance', label: 'Attendance', icon: ClipboardList }

// Update render
{activeView === 'attendance' && <AttendanceView />}
```

**Step 3: Commit**

```bash
git add src/components/AttendanceView.tsx src/App.tsx
git commit -m "feat: add AttendanceView with calendar grid UI"
```

---

### Task 4: Add Salary Calculation Modal

**Files:**

- Modify: `src/components/AttendanceView.tsx`

**Step 1: Add calculation logic**

```typescript
const calculateSalary = (staffMember: any) => {
  const dailyRate = staffMember.expected_salary_pkr / 30
  const staffAttendance = attendance.filter((a) => a.employee_id === staffMember.id)

  const present = staffAttendance.filter((a) => a.status === 'Present').length
  const halfDay = staffAttendance.filter((a) => a.status === 'Half-Day').length
  const late = staffAttendance.filter((a) => a.status === 'Late').length

  const presentDays = present + halfDay * 0.5
  const lateDeduction = late * (dailyRate * 0.1)
  const totalSalary = presentDays * dailyRate - lateDeduction

  return { present, halfDay, late, dailyRate, lateDeduction, totalSalary }
}
```

**Step 2: Add Modal UI**

```tsx
{
  showSalaryModal && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h3 className="text-sm font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <DollarSign size={16} /> Monthly Salary Breakdown
          </h3>
          <button
            onClick={() => setShowSalaryModal(false)}
            className="text-slate-500 hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Staff
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Present
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Daily Rate
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Deductions
                </th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">
                  Net Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {staff.map((s) => {
                const calc = calculateSalary(s)
                return (
                  <tr key={s.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-[11px] font-bold text-white">{s.full_name}</td>
                    <td className="px-4 py-3 text-[10px] text-emerald-400">{calc.present} days</td>
                    <td className="px-4 py-3 text-[10px] text-slate-400">
                      PKR {calc.dailyRate.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-red-400">
                      -{calc.lateDeduction.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono font-bold text-emerald-400 text-right">
                      PKR {calc.totalSalary.toFixed(0)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t border-white/5 flex justify-end gap-3">
          <button className="btn-secondary flex items-center gap-2">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowSalaryModal(false)} className="btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Add "Calculate Salary" button to header**

```tsx
<button onClick={() => setShowSalaryModal(true)} className="btn-primary flex items-center gap-2">
  <DollarSign size={14} /> Calculate Salary
</button>
```

**Step 4: Commit**

```bash
git add src/components/AttendanceView.tsx
git commit -m "feat: add salary calculation modal with breakdown table"
```

---

### Task 5: Integrate with Finance View

**Files:**

- Modify: `src/components/FinanceView.tsx`

**Step 1: Add Attendance Summary Card**

```tsx
<div className="bg-slate-900/40 border border-white/5 rounded-xl p-6">
  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4">
    Attendance Summary
  </h3>
  <div className="grid grid-cols-3 gap-4">
    <div className="text-center">
      <div className="text-2xl font-mono font-bold text-emerald-400">{totalPresent}</div>
      <div className="text-[9px] text-slate-500 uppercase">Total Present Days</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-mono font-bold text-red-400">{totalAbsent}</div>
      <div className="text-[9px] text-slate-500 uppercase">Total Absent Days</div>
    </div>
    <div className="text-center">
      <div className="text-2xl font-mono font-bold text-blue-400">PKR {totalPayroll}</div>
      <div className="text-[9px] text-slate-500 uppercase">Est. Payroll</div>
    </div>
  </div>
  <button
    onClick={() => navigate('attendance')}
    className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
  >
    View Full Attendance Ledger →
  </button>
</div>
```

**Step 2: Commit**

```bash
git add src/components/FinanceView.tsx
git commit -m "feat: add attendance summary card to Finance view"
```

---

### Task 6: Build & Verify

**Step 1: Type check**

```bash
npm run lint
```

**Step 2: Build**

```bash
npm run build
```

**Step 3: Verify**

```bash
grep -rn "any\[\]" src/components/ || echo "Clean"
```

**Step 4: Commit**

```bash
git commit --allow-empty -m "phase: attendance & salary calculation complete, verified build"
```

---

## Testing Checklist

- [ ] Migration applies successfully.
- [ ] Attendance grid renders Staff × Days.
- [ ] Clicking cell cycles status (Present → Absent → Late → Half-Day → Empty).
- [ ] Status colors match design (Green/Red/Yellow/Blue).
- [ ] Month navigation works.
- [ ] Salary modal shows correct breakdown.
- [ ] Formula: `(Present + Half-Day*0.5) * (Salary/30) - LatePenalty`.
- [ ] Finance view shows summary card.
- [ ] Build passes clean.
