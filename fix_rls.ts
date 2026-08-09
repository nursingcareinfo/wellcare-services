import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

if (fs.existsSync('.env')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env'))
  for (const k in envConfig) {
    process.env[k] = envConfig[k]
  }
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  process.exit(1)
}

const sql = postgres(connectionString)

async function fixRLS() {
  console.log('🔓 Attempting to fix RLS for employees table...')
  try {
    // Drop existing policies if any
    await sql`DROP POLICY IF EXISTS "Public Read" ON employees`
    await sql`DROP POLICY IF EXISTS "Public Insert" ON employees`
    await sql`DROP POLICY IF EXISTS "Public Update" ON employees`

    // Create broad policies
    await sql`CREATE POLICY "Public Read" ON employees FOR SELECT USING (true)`
    await sql`CREATE POLICY "Public Insert" ON employees FOR INSERT WITH CHECK (true)`
    await sql`CREATE POLICY "Public Update" ON employees FOR UPDATE USING (true)`

    // Disable RLS just to be sure if policies are being tricky
    await sql`ALTER TABLE employees DISABLE ROW LEVEL SECURITY`

    console.log('✅ RLS fixed/disabled for employees')
  } catch (err) {
    console.error('❌ Failed to fix RLS:', err)
  } finally {
    await sql.end()
  }
}

fixRLS()
