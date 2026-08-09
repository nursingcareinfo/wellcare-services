/**
 * Apply PNC license fields migration directly to Supabase via JS client
 * CLI is blocked by IPv6 on this network; we use the Supabase REST API instead.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://euxzitqllnltlteckeyq.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '' // migrations need service_role — set via env

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
})

const MIGRATION_SQL = `
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS pnc_registration_number TEXT,
  ADD COLUMN IF NOT EXISTS pnc_license_expiry_date DATE;

COMMENT ON COLUMN employees.pnc_registration_number IS 'PNC/PN&MC license registration number';
COMMENT ON COLUMN employees.pnc_license_expiry_date IS 'Expiry date of PNC license card';
`

try {
  const { error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL })
  if (error) {
    // exec_sql might not exist — try raw query via PostgREST
    console.error('RPC exec_sql failed:', error.message)
    console.error('Trying via Supabase SQL API…')

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ sql: MIGRATION_SQL }),
    })
    const body = await resp.json()
    if (resp.ok) {
      console.log('✅ Migration applied successfully via REST API')
    } else {
      console.error('REST API error:', JSON.stringify(body, null, 2))
    }
  } else {
    console.log('✅ Migration applied successfully via RPC')
  }
} catch (err) {
  console.error('Fatal:', err)
}
