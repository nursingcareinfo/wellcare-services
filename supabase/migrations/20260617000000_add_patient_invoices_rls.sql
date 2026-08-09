-- Add RLS policies for patient_invoices so the anon key (public dashboard + invoice.html) can read and create invoices

-- Enable RLS if not already enabled
alter table patient_invoices enable row level security;

-- Allow anon role to SELECT invoices (needed by dashboard UI and invoice.html viewer)
drop policy if exists "anon can read patient_invoices" on patient_invoices;
create policy "anon can read patient_invoices"
on patient_invoices
for select
to anon
using (true);

-- Allow anon role to INSERT invoices (needed by auto-generate in PatientView)
drop policy if exists "anon can insert patient_invoices" on patient_invoices;
create policy "anon can insert patient_invoices"
on patient_invoices
for insert
to anon
with check (true);

-- Allow authenticated role to UPDATE invoices (mark as paid, etc.)
drop policy if exists "authenticated can update patient_invoices" on patient_invoices;
create policy "authenticated can update patient_invoices"
on patient_invoices
for update
to authenticated
using (true)
with check (true);
