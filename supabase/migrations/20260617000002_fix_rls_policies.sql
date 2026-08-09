-- Fix RLS policies: restrict core data tables to authenticated role only
-- The anon role should NOT have access to employees, patients, shifts, etc.
-- Only patient_intakes and staff_intakes remain anon-INSERT (needed by public forms)
-- patient_invoices retains anon-SELECT (needed by public invoice.html viewer)

-- First, enable RLS on tables that had it disabled
alter table employees enable row level security;
alter table patients enable row level security;
alter table manual_shifts enable row level security;
alter table salary_advances enable row level security;

-- 1. employees — restrict to authenticated only
drop policy if exists "Allow all on employees" on employees;
create policy "authenticated_all_employees" on employees
  for all to authenticated using (true) with check (true);

-- 2. patients — restrict to authenticated only
drop policy if exists "Allow all on patients" on patients;
create policy "authenticated_all_patients" on patients
  for all to authenticated using (true) with check (true);

-- 3. manual_shifts — restrict to authenticated only
drop policy if exists "Allow all on manual_shifts" on manual_shifts;
create policy "authenticated_all_manual_shifts" on manual_shifts
  for all to authenticated using (true) with check (true);

-- 4. salary_advances — restrict to authenticated only
drop policy if exists "Allow all on salary_advances" on salary_advances;
create policy "authenticated_all_salary_advances" on salary_advances
  for all to authenticated using (true) with check (true);

-- 5. staff_attendance — restrict to authenticated only
drop policy if exists "Allow all on staff_attendance" on staff_attendance;
create policy "authenticated_all_staff_attendance" on staff_attendance
  for all to authenticated using (true) with check (true);

-- 6. patient_invoices — drop anon INSERT (dashboard creates invoices via authenticated role)
-- Keep anon SELECT (needed by public invoice.html viewer)
-- Add authenticated SELECT (needed by dashboard invoice list)
drop policy if exists "anon can insert patient_invoices" on patient_invoices;
create policy "authenticated_select_patient_invoices" on patient_invoices
  for select to authenticated using (true);

-- 7. Make financial views respect RLS (security_invoker)
alter view real_time_margin_view set (security_invoker = true);
alter view staff_accrual_view set (security_invoker = true);
