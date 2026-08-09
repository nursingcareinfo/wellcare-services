# Salary Period & Paid/Unpaid Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the attendance calendar into two salary periods per month (1st–15th and 16th–end), with implicit paid/unpaid day tracking.

**Architecture:** No DB schema changes. Only modify `StaffAttendanceCalendarModal.tsx` to add period-based state/navigation, period-aware summary filtering, and visual dimming of out-of-period days. Add a single helper method to `attendanceService.ts` for date-range queries (or reuse existing — both periods fall within one calendar month so existing month query suffices).

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, date-fns

---

### Task 1: Add period helpers + state to attendance modal

**Files:**
- Modify: `src/components/StaffAttendanceCalendarModal.tsx`

**Step 1: Add period helper functions**

Add these before the component function:

```typescript
function getPeriodRange(year: number, month: number, period: 1 | 2) {
  if (period === 1) {
    return { start: 1, end: 15 }
  }
  const lastDay = new Date(year, month + 1, 0).getDate()
  return { start: 16, end: lastDay }
}

function getPeriodLabel(year: number, month: number, period: 1 | 2): string {
  const m = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
  const range = getPeriodRange(year, month, period)
  return `${m} • Day ${range.start}–${range.end}`
}
```

**Step 2: Replace month state with period state**

Replace:
```typescript
const [currentDate, setCurrentDate] = useState(new Date())
```
With:
```typescript
const today = new Date()
const [periodYear, setPeriodYear] = useState(today.getFullYear())
const [periodMonth, setPeriodMonth] = useState(today.getMonth())
const [periodNum, setPeriodNum] = useState<1 | 2>(today.getDate() <= 15 ? 1 : 2)
```

Replace derived variables:
```typescript
const year = currentDate.getFullYear()
const month = currentDate.getMonth()
```
With:
```typescript
const year = periodYear
const month = periodMonth
```

Replace `useEffect` dependency:
```typescript
}, [year, month, staffId])
```
With:
```typescript
}, [periodYear, periodMonth, periodNum, staffId])
```

**Step 3: Add period navigation helpers**

Add before the `loadAttendance` function:

```typescript
const goToPrevPeriod = () => {
  if (periodNum === 1) {
    const prevMonth = periodMonth - 1
    if (prevMonth < 0) {
      setPeriodYear(periodYear - 1)
      setPeriodMonth(11)
    } else {
      setPeriodMonth(prevMonth)
    }
    setPeriodNum(2)
  } else {
    setPeriodNum(1)
  }
}

const goToNextPeriod = () => {
  if (periodNum === 2) {
    const nextMonth = periodMonth + 1
    if (nextMonth > 11) {
      setPeriodYear(periodYear + 1)
      setPeriodMonth(0)
    } else {
      setPeriodMonth(nextMonth)
    }
    setPeriodNum(1)
  } else {
    setPeriodNum(2)
  }
}
```

**Step 4: Update month navigation buttons**

Replace:
```tsx
<button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
```
With:
```tsx
<button onClick={goToPrevPeriod}>
```

Replace:
```tsx
<button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
```
With:
```tsx
<button onClick={goToNextPeriod}>
```

Replace month header:
```tsx
{new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
```
With:
```tsx
{getPeriodLabel(year, month, periodNum)}
```

**Step 5: Add period-aware dimming**

Add helper:
```typescript
const periodRange = getPeriodRange(year, month, periodNum)
const isInActivePeriod = (day: number) =>
  day >= periodRange.start && day <= periodRange.end
```

Update calendar day button classes. Find the button with `className={cn('h-8 rounded border text-[10px] font-bold...` and replace with:

```tsx
<button
  key={day}
  onClick={() => isInActivePeriod(day) && cycleStatus(day)}
  className={cn(
    'h-8 rounded border text-[10px] font-bold transition-all flex items-center justify-center',
    isInActivePeriod(day) ? 'hover:scale-105' : 'opacity-30 cursor-default',
    isInActivePeriod(day) && getStatusColor(status),
    !isInActivePeriod(day) && 'bg-white/[0.02] border-white/5'
  )}
  title={`${day} - ${isInActivePeriod(day) ? (status || 'Not marked') : 'Outside period'}`}
>
  {day}
</button>
```

**Step 6: Filter summary to active period**

In `calculateSummary()`, replace:
```typescript
const staffAttendance = attendance.filter((a) => a.employee_id === staffId)
```
With:
```typescript
const periodRange = getPeriodRange(year, month, periodNum)
const staffAttendance = attendance.filter((a) => {
  const day = new Date(a.attendance_date).getDate()
  return (
    a.employee_id === staffId &&
    day >= periodRange.start &&
    day <= periodRange.end
  )
})
```

Update summary labels. In the JSX, replace:
```tsx
<span className="text-slate-600 ml-1">day</span>
```
With:
```tsx
<span className="text-slate-600 ml-1">paid</span>
```

Replace:
```tsx
<span className="text-slate-600 ml-1">absent</span>
```
With:
```tsx
<span className="text-slate-600 ml-1">unpaid</span>
```

**Step 7: Verify no build errors**

Run: `npx tsc --noEmit`
Expected: Exit 0, no type errors.

**Step 8: Commit**

```bash
git add src/components/StaffAttendanceCalendarModal.tsx
git commit -m "feat(attendance): split calendar into 1st-15th/16th-EOM salary periods with paid/unpaid tracking"
```

### Task 2: Build & verify on live site

**Files:** (no code changes)

**Step 1: Production build**

Run: `npm run build`
Expected: Exit 0, no errors.

**Step 2: Push to deploy**

```bash
git push origin main
```

**Step 3: Verify on live site**

Navigate to live site, open STAFF TOOL, click Attendance on a staff card.
- [ ] Period header shows `"June 2026 • Day 1–15"` or `"June 2026 • Day 16–30"`
- [ ] Days outside active period are dimmed (opacity-30, no hover)
- [ ] Days inside period are clickable and cycle normally
- [ ] Summary counts only active period days
- [ ] Summary labels show "paid" and "unpaid"
- [ ] No console errors
