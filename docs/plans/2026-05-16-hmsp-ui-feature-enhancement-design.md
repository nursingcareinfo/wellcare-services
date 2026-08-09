# HMSP Dashboard — UI & Feature Enhancement Design

**Date:** 2026-05-16
**Status:** Draft — awaiting approval
**Approach:** Incremental Enhancement (Approach 1)

---

## Problem Statement

The HMSP Dashboard is live on GitHub Pages and actively used for healthcare staff management in Karachi. The current codebase has:

- No TypeScript type safety (`any[]` everywhere)
- `alert()` for user feedback instead of proper notifications
- `console.log` scattered throughout production code
- Inconsistent UI patterns across views
- Stub features (WhatsApp view) with no implementation
- Direct Supabase queries in components with no error abstraction

---

## Section 1: Architecture & Foundation

### 1.1 Type Definitions

**File:** `src/types.ts`

Expand existing types to cover all database entities:

```typescript
interface Employee {
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
  is_verified: boolean
  rating: number
  dob?: string
  religion?: string
  father_husband_name?: string
  marital_status?: string
  skills?: string[]
  relative_info?: { name: string; phone: string; relationship: string }
  critical_missing_info: boolean
  created_at: string
}

interface Patient {
  id: string
  // ... existing fields
}

interface Shift {
  id: string
  employee_id: string
  patient_id: string
  shift_type: 'Morning' | 'Night'
  status: 'Scheduled' | 'Completed' | 'Abandoned'
  date: string
}

interface Advance {
  id: string
  employee_id: string
  amount_pkr: number
  payment_method: string
  status: 'Pending' | 'Settled'
  created_at: string
}
```

**Impact:** All `any[]` replaced with typed arrays. Supabase responses typed via generics.

### 1.2 Toast Notification System

**New files:** `src/components/Toast.tsx`, `src/context/ToastContext.tsx`

- Lightweight custom implementation (no new dependency)
- 3 variants: `success` (emerald), `error` (red), `info` (blue)
- Auto-dismiss after 3 seconds, manual dismiss button
- Stack multiple toasts with animation
- Replace all `alert()` calls across views

### 1.3 Error Boundary

**New file:** `src/components/ErrorBoundary.tsx`

- Wrap each view component in `<ErrorBoundary>`
- Graceful fallback: "Something went wrong" + Retry button
- Catches Supabase query failures without crashing the app
- Logs errors to console in dev, silent in production

### 1.4 Service Layer Consolidation

**Files:** All `src/services/*.ts`

- Add proper return types to all service functions
- Centralized error handling (throw typed errors, not raw Supabase errors)
- Components handle UI state only, not error logic
- Remove `console.error` from components — services log, components display

---

## Section 2: UI Improvements

### 2.1 Dashboard Overhaul

**File:** `src/components/DashboardView.tsx`

- Replace hardcoded `+2%`, `+5%` trends with real calculations (current vs previous 30-day average)
- Add "Today's Shifts" card showing Morning/Night assignments at a glance
- Make staff distribution chart interactive — click a bar to filter Staff view by category
- Add refresh indicator (show when data is loading vs stale)

### 2.2 Staff Cards Redesign

**File:** `src/components/StaffView.tsx`

- Cleaner visual hierarchy:
  - Row 1: Avatar + Name + Position
  - Row 2: Location + Key stats (salary, rating, availability toggle)
  - Collapsible "Details" for secondary info (religion, age, family info)
- Quick-action buttons always visible: Edit, Toggle Availability, Advance
- Reduce visual noise — fewer borders, more whitespace

### 2.3 Global UI Consistency

**Files:** `src/index.css`, all view components

- Standardize heading sizes: `text-xs font-black uppercase tracking-[0.2em]` for section headers
- Consistent card padding: `p-6` across all views
- Unified loading states: spinner + "Loading..." text pattern
- Better empty states: icon + title + description + CTA button
- CSS class shortcuts in `@theme` for common patterns

### 2.4 Mobile Improvements

**Files:** `src/App.tsx`, all view components

- Bottom nav labels: `text-[10px]` (up from `text-[8px]`)
- Touch targets: minimum 44px height
- Modals: full-screen drawers on mobile (`<768px`)
- Staff cards: verified single-column on mobile

---

## Section 3: New Features

### 3.1 WhatsApp Analytics View

**File:** `src/components/WhatsAppView.tsx` (new)

- Replace current stub in `App.tsx`
- UI sections:
  - Broadcast stats (sent, delivered, read) — mock data structure
  - Contact labels (Staff, Patient, Lead, Inactive)
  - Quick-reply templates list
- Data layer: placeholder interface ready for WhatsApp API integration
- Integration point for `whatsapp-automation` skill in Phase 2

### 3.2 Shift Management Enhancements

**Files:** `src/components/CalendarView.tsx`, `src/services/shiftService.ts`

- Conflict detection: warn when same staff assigned to overlapping shifts
- Quick-fill: button to auto-assign available staff to unfilled shifts
- Shift history per patient: who worked, when, status
- Color-coded shift types in calendar (Morning = blue, Night = purple)

### 3.3 Payout/Finance View Improvements

**File:** `src/components/FinanceView.tsx`

- Monthly payout summary table by staff member
- Advance deduction tracking (auto-calculated from `salary_advances`)
- Export to CSV button for accounting
- Visual breakdown: Gross → Deductions → Net Pay (bar chart)

### 3.4 Matchmaker AI Boost

**File:** `src/components/MatchmakerView.tsx`, `src/services/geminiService.ts`

- Gemini-powered matching based on:
  - Patient condition/needs vs staff skills
  - Location proximity (Karachi area matching)
  - Availability windows
- Show match score percentage with reasoning
- Rank results by best fit

---

## Implementation Order

1. **Phase 1 — Foundation (Week 1):** Types, Toast, Error Boundary, Service types
2. **Phase 2 — UI Polish (Week 1-2):** Dashboard, Staff cards, Global consistency, Mobile
3. **Phase 3 — Features (Week 2-3):** WhatsApp view, Shift enhancements, Finance improvements, Matchmaker AI

---

## Risks & Mitigations

| Risk                            | Mitigation                                                         |
| ------------------------------- | ------------------------------------------------------------------ |
| Breaking existing functionality | Test each view after changes, use error boundaries                 |
| GitHub Pages deploy failures    | Verify build passes before each commit                             |
| Supabase schema changes         | Types should match current schema, add comments for future updates |
| Scope creep                     | Stick to defined features, defer WhatsApp API to Phase 2           |

---

## Success Criteria

- [ ] Zero `any[]` in component code
- [ ] Zero `alert()` calls
- [ ] Zero `console.log` in production code
- [ ] All views have loading, error, and empty states
- [ ] Toast notifications replace all alerts
- [ ] WhatsApp view has functional UI (mock data)
- [ ] Shift calendar has conflict detection
- [ ] Finance view has CSV export
- [ ] Matchmaker shows AI-powered match scores
- [ ] Mobile nav is usable (44px touch targets)
