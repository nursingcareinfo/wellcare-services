-- Fix: Race condition in emp_no generation causing duplicate key violation
-- Migration: 029_fix_emp_no_race_condition.sql
--
-- Problem: createStaff() generates emp_no client-side by querying ORDER BY
-- created_at DESC and incrementing. Two concurrent requests can read the same
-- last row and calculate the same next number, causing:
--
--   duplicate key value violates unique constraint "employees_emp_no_key"
--
-- Fix: Replace the application-side counter with a Postgres sequence and the
-- nextval() SQL expression so the database hands out a fresh, unique value on
-- every call, even under concurrency.

-- 1) Create the sequence (idempotent)
CREATE SEQUENCE IF NOT EXISTS employees_emp_no_seq;

-- 2) Seed the sequence from the current maximum emp_no so existing staff keep
--    their numbers and the next new staff gets the next available number.
SELECT setval(
    'employees_emp_no_seq',
    COALESCE(MAX(CAST(SUBSTRING(emp_no FROM '\d+$') AS int)), 0),
    false
  )
FROM employees;

-- 3) Helper: returns the next id in NC-KHI-0001 format
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

-- 4) Expose to app roles so the Supabase client can call get_next_emp_no()
GRANT USAGE, SELECT ON SEQUENCE employees_emp_no_seq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_next_emp_no() TO anon, authenticated;

-- 5) Document the intent
COMMENT ON FUNCTION get_next_emp_no() IS
  'Returns next staff emp_no as NC-KHI-XXXX from a database sequence to avoid '
  'concurrent duplicate-key errors during inserts.';
