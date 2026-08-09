# Staff Shift Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable inline shift assignment from Staff cards — assign patient, shift type (Morning/Night), and per-shift rate, with unassignment capability.

**Architecture:** Extend `shiftService` with CRUD operations for `manual_shifts`. Add inline assignment panel to StaffView cards that appears on toggle. PatientView shows assigned staff per shift slot. Single source of truth: `manual_shifts` table.

**Tech Stack:** React 19, TypeScript, Supabase JS client, TailwindCSS 4, lucide-react

---

### Task 1: Add Shift CRUD Methods to shiftService

**Files:**

- Modify: `src/services/shiftService.ts`

**Step 1: Add createShift method**

```typescript
async createShift(shift: {
  employee_id: string
  patient_id: string
  shift_date: string
  shift_type: 'Morning' | 'Night'
  decided_rate_pkr: number
}) {
  const { data, error } = await supabase
    .from('manual_shifts')
    .insert([shift])
    .select('*, patient:patient_id(patient_name)')
    .single()

  if (error) throw error
  return data
}
```

**Step 2: Add deleteShift method**

```typescript
async deleteShift(employeeId: string, shiftDate: string) {
  const { error } = await supabase
    .from('manual_shifts')
    .delete()
    .eq('employee_id', employeeId)
    .eq('shift_date', shiftDate)

  if (error) throw error
}
```

**Step 3: Add getTodayShifts method**

```typescript
async getTodayShifts() {
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('manual_shifts')
    .select('*, employee:employee_id(full_name), patient:patient_id(patient_name)')
    .eq('shift_date', today)

  if (error) throw error
  return data || []
}
```

**Step 4: Add getAvailablePatientsForShift method**

```typescript
async getAvailablePatientsForShift(shiftType: 'Morning' | 'Night') {
  const today = new Date().toISOString().split('T')[0]

  // Get patients who don't have a staff for this shift type today
  const { data, error } = await supabase
    .from('patients')
    .select('id, patient_name, district, service_type')
    .eq('status', 'Active')
    .not('id', 'in', `(
      SELECT patient_id FROM manual_shifts
      WHERE shift_date = '${today}' AND shift_type = '${shiftType}'
    )`)

  if (error) throw error
  return data || []
}
```

**Step 5: Commit**

```bash
git add src/services/shiftService.ts
git commit -m "feat: add shift CRUD methods — create, delete, getToday, getAvailablePatients"
```

---

### Task 2: Add Assignment State to StaffView

**Files:**

- Modify: `src/components/StaffView.tsx`

**Step 1: Add state variables**

```typescript
const [assigningStaffId, setAssigningStaffId] = useState<string | null>(null)
const [assignmentForm, setAssignmentForm] = useState({
  patient_id: '',
  shift_type: 'Morning' as 'Morning' | 'Night',
  decided_rate_pkr: 0,
})
const [availablePatients, setAvailablePatients] = useState<any[]>([])
const [isAssigning, setIsAssigning] = useState(false)
```

**Step 2: Add loadAvailablePatients function**

```typescript
const loadAvailablePatients = async (shiftType: 'Morning' | 'Night') => {
  try {
    const patients = await shiftService.getAvailablePatientsForShift(shiftType)
    setAvailablePatients(patients)
  } catch (error) {
    console.error('Error loading patients:', error)
  }
}
```

**Step 3: Add handleAssignShift function**

```typescript
const handleAssignShift = async (staffId: string) => {
  if (!assignmentForm.patient_id || !assignmentForm.decided_rate_pkr) return

  setIsAssigning(true)
  try {
    const today = new Date().toISOString().split('T')[0]
    await shiftService.createShift({
      employee_id: staffId,
      patient_id: assignmentForm.patient_id,
      shift_date: today,
      shift_type: assignmentForm.shift_type,
      decided_rate_pkr: assignmentForm.decided_rate_pkr,
    })

    // Update staff availability
    await staffService.updateStaff(staffId, { is_available: false })

    setAssigningStaffId(null)
    loadStaff() // Refresh list
  } catch (error: any) {
    alert(`Assignment failed: ${error.message}`)
  } finally {
    setIsAssigning(false)
  }
}
```

**Step 4: Add handleUnassignShift function**

```typescript
const handleUnassignShift = async (staffId: string) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    await shiftService.deleteShift(staffId, today)
    await staffService.updateStaff(staffId, { is_available: true })
    loadStaff()
  } catch (error: any) {
    alert(`Unassign failed: ${error.message}`)
  }
}
```

**Step 5: Commit**

```bash
git add src/components/StaffView.tsx
git commit -m "feat: add assignment state and handlers to StaffView"
```

---

### Task 3: Build Inline Assignment Panel UI

**Files:**

- Modify: `src/components/StaffView.tsx`

**Step 1: Replace availability toggle with expanded logic**

Find the availability toggle section (~line 556) and replace with:

```tsx
<div className="flex flex-col items-end gap-1">
  {/* Toggle Button */}
  <button
    onClick={() => {
      if (staff.is_available) {
        setAssigningStaffId(staff.id)
        setAssignmentForm({
          patient_id: '',
          shift_type: 'Morning',
          decided_rate_pkr: staff.expected_salary_pkr || 0,
        })
        loadAvailablePatients('Morning')
      } else {
        setAssigningStaffId(staff.id === assigningStaffId ? null : staff.id)
      }
    }}
    className={cn(
      'px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all',
      staff.is_available
        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
    )}
  >
    {staff.is_available ? 'Available' : 'On Duty'}
  </button>

  {/* Assignment Panel */}
  {assigningStaffId === staff.id && !staff.is_available && (
    <div className="mt-2 p-3 bg-slate-800/50 border border-white/10 rounded-lg space-y-2 w-48">
      <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">
        {staffAssignments[staff.id]}
      </p>
      <button
        onClick={() => handleUnassignShift(staff.id)}
        className="w-full py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-bold uppercase tracking-wider rounded hover:bg-red-500/20"
      >
        Remove Assignment
      </button>
    </div>
  )}

  {/* Assignment Form */}
  {assigningStaffId === staff.id && staff.is_available && (
    <div className="mt-2 p-3 bg-slate-800/50 border border-white/10 rounded-lg space-y-2 w-56">
      {/* Patient Select */}
      <select
        value={assignmentForm.patient_id}
        onChange={(e) => setAssignmentForm({ ...assignmentForm, patient_id: e.target.value })}
        className="w-full bg-black/40 border border-white/5 rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-emerald-500/40"
      >
        <option value="">Select Patient</option>
        {availablePatients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.patient_name}
          </option>
        ))}
      </select>

      {/* Shift Type */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setAssignmentForm({ ...assignmentForm, shift_type: 'Morning' })
            loadAvailablePatients('Morning')
          }}
          className={cn(
            'flex-1 py-1 text-[8px] font-bold uppercase rounded border',
            assignmentForm.shift_type === 'Morning'
              ? 'bg-blue-500/20 border-blue-500/30 text-blue-400'
              : 'bg-white/5 border-white/10 text-slate-500'
          )}
        >
          Morning
        </button>
        <button
          onClick={() => {
            setAssignmentForm({ ...assignmentForm, shift_type: 'Night' })
            loadAvailablePatients('Night')
          }}
          className={cn(
            'flex-1 py-1 text-[8px] font-bold uppercase rounded border',
            assignmentForm.shift_type === 'Night'
              ? 'bg-purple-500/20 border-purple-500/30 text-purple-400'
              : 'bg-white/5 border-white/10 text-slate-500'
          )}
        >
          Night
        </button>
      </div>

      {/* Rate Input */}
      <input
        type="number"
        value={assignmentForm.decided_rate_pkr}
        onChange={(e) =>
          setAssignmentForm({ ...assignmentForm, decided_rate_pkr: parseInt(e.target.value) || 0 })
        }
        className="w-full bg-black/40 border border-white/5 rounded px-2 py-1.5 text-[10px] text-emerald-400 font-mono outline-none focus:border-emerald-500/40"
        placeholder="Rate PKR"
      />

      {/* Assign Button */}
      <button
        onClick={() => handleAssignShift(staff.id)}
        disabled={!assignmentForm.patient_id || isAssigning}
        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 text-[9px] font-black uppercase tracking-wider rounded transition-all"
      >
        {isAssigning ? 'Assigning...' : 'Assign Shift'}
      </button>
    </div>
  )}

  {/* On Duty Info Display */}
  {!staff.is_available && staffAssignments[staff.id] && (
    <span className="text-[8px] text-slate-500 font-medium truncate max-w-[120px]">
      {staffAssignments[staff.id]}
    </span>
  )}
</div>
```

**Step 2: Commit**

```bash
git add src/components/StaffView.tsx
git commit -m "feat: add inline assignment panel UI to staff cards"
```

---

### Task 4: Update Staff Card Display for On Duty State

**Files:**

- Modify: `src/components/StaffView.tsx`

**Step 1: Enhance on-duty display**

Update the card footer to show shift details when on duty:

```tsx
{
  !staff.is_available && (
    <div className="px-4 py-2 bg-amber-500/5 border-t border-amber-500/10 space-y-1">
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-amber-400 font-bold uppercase">
          {staffShifts[staff.id]?.shift_type || 'Morning'} Shift
        </span>
        <span className="text-emerald-400 font-mono">
          PKR {(staffShifts[staff.id]?.decided_rate_pkr || 0).toLocaleString()}
        </span>
      </div>
      <p className="text-[8px] text-slate-500">
        Patient: {staffAssignments[staff.id] || 'Unknown'}
      </p>
    </div>
  )
}
```

**Step 2: Add staffShifts state**

```typescript
const [staffShifts, setStaffShifts] = useState<Record<string, any>>({})
```

**Step 3: Load shift data in loadStaff**

```typescript
// After loading staff, fetch today's shifts
const todayShifts = await shiftService.getTodayShifts()
const shiftsMap: Record<string, any> = {}
todayShifts.forEach((shift) => {
  shiftsMap[shift.employee_id] = shift
})
setStaffShifts(shiftsMap)
```

**Step 4: Commit**

```bash
git add src/components/StaffView.tsx
git commit -m "feat: show shift details (type, rate, patient) on on-duty cards"
```

---

### Task 5: Update PatientView to Show Assigned Staff

**Files:**

- Modify: `src/components/PatientView.tsx`

**Step 1: Add shift data loading**

```typescript
const [todayShifts, setTodayShifts] = useState<any[]>([])

useEffect(() => {
  loadPatients()
  loadTodayShifts()
}, [])

const loadTodayShifts = async () => {
  try {
    const shifts = await shiftService.getTodayShifts()
    setTodayShifts(shifts)
  } catch (error) {
    console.error('Error loading shifts:', error)
  }
}
```

**Step 2: Update patient card to show assigned staff**

Replace the placeholder assignment slots with actual data:

```tsx
{
  /* Day Shift Slot */
}
;<div className="bg-white/5 rounded-xl p-4 border border-white/10 relative overflow-hidden">
  <div className="absolute top-0 right-0 px-2 py-1 bg-blue-500/20 text-blue-400 text-[7px] font-black uppercase tracking-widest border-b border-l border-blue-500/30 rounded-bl-md">
    Morning Shift
  </div>
  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-3">
    Assigned Staff
  </p>
  {(() => {
    const morningShift = todayShifts.find(
      (s) => s.patient_id === patient.id && s.shift_type === 'Morning'
    )
    return morningShift ? (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-500">
            <User size={14} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{morningShift.employee?.full_name}</p>
            <p className="text-[8px] text-slate-500">
              Rate: PKR {morningShift.decided_rate_pkr?.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-amber-400/50 text-[10px] uppercase font-bold italic py-2">
        <AlertCircle size={14} /> Slot Unassigned
      </div>
    )
  })()}
</div>
```

**Step 3: Add Night shift slot for 24h patients**

```tsx
{
  ;(patient.service_type === '24h' || patient.service_type === '12h_night') && (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 px-2 py-1 bg-purple-500/20 text-purple-400 text-[7px] font-black uppercase tracking-widest border-b border-l border-purple-500/30 rounded-bl-md">
        Night Shift
      </div>
      {/* Similar structure for night shift */}
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/PatientView.tsx
git commit -m "feat: show assigned staff on patient cards with shift details"
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

**Step 3: Verify no regressions**

```bash
grep -rn "any\[\]" src/components/ || echo "Clean"
grep -rn "alert(" src/components/ || echo "Clean"
```

**Step 4: Commit**

```bash
git commit --allow-empty -m "phase: staff shift assignment complete, verified build"
```

---

## Testing Checklist

- [ ] Click "Available" on staff card → assignment panel opens
- [ ] Patient dropdown shows only unassigned patients
- [ ] Switching shift type updates patient list
- [ ] Rate defaults to staff's expected salary
- [ ] Click "Assign Shift" → creates record, card shows "On Duty"
- [ ] Card displays shift type, patient name, rate
- [ ] Click "On Duty" → shows unassign option
- [ ] Click "Remove Assignment" → deletes record, staff back to "Available"
- [ ] PatientView shows assigned staff per shift slot
- [ ] Can't double-book same staff on same shift (DB constraint)
- [ ] Build passes clean
