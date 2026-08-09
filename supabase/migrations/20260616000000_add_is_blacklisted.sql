ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false;
