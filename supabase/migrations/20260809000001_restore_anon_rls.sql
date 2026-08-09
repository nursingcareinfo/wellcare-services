-- Restore anon/publishable-key access to core tables.
-- The HMSP dashboard authenticates with a local-only UI gate (AuthContext)
-- and never calls supabase.auth, so the anon role needs full access —
-- matching db-recreate.sql ("demo app uses the anon/publishable key for ALL access")
-- and the previously live database.

drop policy if exists "authenticated_all_employees" on employees;
drop policy if exists "authenticated_all_patients" on patients;
drop policy if exists "authenticated_all_manual_shifts" on manual_shifts;
drop policy if exists "authenticated_all_salary_advances" on salary_advances;
drop policy if exists "authenticated_all_staff_attendance" on staff_attendance;

create policy "Allow all on employees" on employees for all using (true) with check (true);
create policy "Allow all on patients" on patients for all using (true) with check (true);
create policy "Allow all on manual_shifts" on manual_shifts for all using (true) with check (true);
create policy "Allow all on salary_advances" on salary_advances for all using (true) with check (true);
create policy "Allow all on staff_attendance" on staff_attendance for all using (true) with check (true);
