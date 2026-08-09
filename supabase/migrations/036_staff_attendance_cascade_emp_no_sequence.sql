-- ============================================================
-- 036: staff_attendance CASCADE + get_next_emp_no sequence
--
-- Two live-DB fixes that drift from db-recreate.sql:
--   1) staff_attendance.employee_id lacks ON DELETE CASCADE on the live
--      project, so deleting a staff record 409s even after attendance is
--      the only dependent data. Attendance is a detail table (like
--      db-recreate.sql declares) — shifts/advances stay NON-cascade
--      because they are financial records.
--   2) get_next_emp_no() does not exist on the live project (migration
--      029 was never applied). The app falls back to client-side max+1,
--      which works but races under concurrency; the sequence makes it
--      atomic.
--
-- Run in: Supabase dashboard -> SQL Editor (idempotent; safe to re-run).
-- ============================================================

-- 1) staff_attendance -> employees ON DELETE CASCADE
ALTER TABLE staff_attendance
  DROP CONSTRAINT IF EXISTS staff_attendance_employee_id_fkey;
ALTER TABLE staff_attendance
  ADD CONSTRAINT staff_attendance_employee_id_fkey
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 2) emp_no sequence + RPC (from 029_fix_emp_no_race_condition.sql)
CREATE SEQUENCE IF NOT EXISTS employees_emp_no_seq;

SELECT setval(
    'employees_emp_no_seq',
    COALESCE(MAX(CAST(SUBSTRING(emp_no FROM '\d+$') AS int)), 0),
    false
  )
FROM employees;

CREATE OR REPLACE FUNCTION get_next_emp_no()
RETURNS text
LANGUAGE plpgsql
AS
$$
DECLARE
  v_seq bigint;
BEGIN
  v_seq := nextval('employees_emp_no_seq');
  RETURN 'NC-KHI-' || LPAD(v_seq::text, 4, '0');
END
$$;

GRANT USAGE, SELECT ON SEQUENCE employees_emp_no_seq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_next_emp_no() TO anon, authenticated;

COMMENT ON FUNCTION get_next_emp_no() IS
  'Returns next staff emp_no as NC-KHI-XXXX from a database sequence to avoid '
  'concurrent duplicate-key errors during inserts.';
