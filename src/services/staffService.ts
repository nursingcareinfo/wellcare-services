import { supabase } from '../lib/supabase'

/**
 * Staff persistence layer — DB-compatible with the live `employees` table.
 *
 * Verified against the live schema (db-recreate.sql + PostgREST introspection):
 *   - Every insert/update payload is filtered through EMPLOYEE_COLUMNS, so a
 *     stray/legacy key can never cause PGRST204 ("Could not find the column").
 *   - phone_primary is normalized to the CHECK format `+92 3XX XXXXXXX`
 *     (form feeds in `03XX-XXXXXXX`, `033XX-XXXXXXX`, `92300...`, etc.).
 *   - emp_no is generated client-side (max+1) with a retry on the UNIQUE race;
 *     the optional get_next_emp_no RPC is attempted first but never required
 *     (it does not exist on the live project).
 *   - CNIC duplicates update the existing row (preserves emp_no) instead of
 *     erroring on the UNIQUE constraint.
 */

export interface Staff {
  id: string
  emp_no?: string
  full_name?: string
  father_husband_name?: string
  cnic_number?: string
  dob?: string
  gender?: string
  marital_status?: string
  religion?: string
  relative_info?: { name?: string; phone?: string; relationship?: string } | null
  phone_primary?: string
  whatsapp_number?: string
  district?: string
  complete_address?: string
  position_applied?: string
  experience_years?: number
  shift_preference?: string
  expected_salary_pkr?: number
  preferred_payment_method?: string
  bank_info?: Record<string, unknown> | null
  is_active: boolean
  is_available: boolean
  is_verified?: boolean
  is_acknowledgment_signed?: boolean
  is_blacklisted?: boolean
  data_confidence?: string
  critical_missing_info?: boolean
  missing_fields_list?: string[]
  pnc_registration_number?: string
  pnc_license_expiry_date?: string
  document_urls?: Record<string, unknown> | null
  rating?: number
  category?: string
  service_end_date?: string | null
  service_end_reason?: string | null
  service_end_notes?: string | null
  created_at?: string
  updated_at?: string
}

/** Columns that actually exist on the live `employees` table. */
const EMPLOYEE_COLUMNS = new Set<string>([
  'id',
  'emp_no',
  'full_name',
  'father_husband_name',
  'cnic_number',
  'dob',
  'gender',
  'marital_status',
  'religion',
  'phone_primary',
  'whatsapp_number',
  'district',
  'complete_address',
  'position_applied',
  'experience_years',
  'shift_preference',
  'expected_salary_pkr',
  'preferred_payment_method',
  'bank_info',
  'is_active',
  'is_available',
  'is_verified',
  'is_acknowledgment_signed',
  'is_blacklisted',
  'data_confidence',
  'critical_missing_info',
  'missing_fields_list',
  'pnc_registration_number',
  'pnc_license_expiry_date',
  'document_urls',
  'rating',
  'category',
  'relative_info',
  'service_end_date',
  'service_end_reason',
  'service_end_notes',
  'created_at',
  'updated_at',
])

/** Keep only keys that exist on the live table. Unknown keys → dropped (no PGRST204). */
function onlyDbColumns<T extends Record<string, unknown>>(row: T): Partial<T> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (EMPLOYEE_COLUMNS.has(key) && value !== undefined) clean[key] = value
  }
  return clean as Partial<T>
}

/**
 * Normalize any Pakistani mobile to the DB CHECK format `+92 3XX XXXXXXX`.
 * Accepts: 03XX-XXXXXXX, 033XX-XXXXXXX, 92300XXXXXXX, 300XXXXXXX,
 * +92 300 XXXXXXX, or already-canonical input. Returns null when the digits
 * cannot be interpreted as a valid Pakistani mobile.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null
  let digits = String(input).replace(/\D/g, '')
  if (digits.startsWith('92')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (!/^3\d{9}$/.test(digits)) return null
  return `+92 ${digits.slice(0, 3)} ${digits.slice(3)}`
}

/** Normalize CNIC to `XXXXX-XXXXXXX-X`. Returns null when not 13 digits. */
export function normalizeCNIC(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = String(input).replace(/\D/g, '')
  if (digits.length !== 13) return null
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

/** emp_no with a fresh serial per new employee. */
function empNoFor(serial: number): string {
  return `NC-KHI-${String(serial).padStart(4, '0')}`
}

async function nextEmpNo(): Promise<string> {
  // Preferred: DB sequence RPC (atomic, race-safe) — absent on live project, so fall back.
  const { data, error } = await supabase.rpc('get_next_emp_no')
  if (!error && data) return String(data)

  const { data: latest } = await supabase
    .from('employees')
    .select('emp_no')
    .not('emp_no', 'is', null)
    .order('emp_no', { ascending: false })
    .limit(1)

  const last = latest && latest.length > 0 ? latest[0]?.emp_no : null
  const match = last ? String(last).match(/(\d+)$/) : null
  const serial = match ? parseInt(match[1], 10) + 1 : 1
  return empNoFor(serial)
}

export const staffService = {
  async getAllStaff(): Promise<Staff[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []) as Staff[]
  },

  async getActiveStaffCount(): Promise<number> {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
    if (error) throw error
    return count || 0
  },

  async getAvailableStaff(): Promise<Staff[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_available', true)
      .eq('is_active', true)
    if (error) throw error
    return (data || []) as Staff[]
  },

  async getAvailableStaffCount(): Promise<number> {
    const { count, error } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_available', true)
      .eq('is_active', true)
    if (error) throw error
    return count || 0
  },

  /**
   * Create a staff record. CNIC duplicates update the existing row (emp_no and
   * timestamps preserved). New records get the next emp_no, with a bounded
   * retry if two clients race the UNIQUE constraint.
   */
  async createStaff(staffData: Partial<Staff>): Promise<Staff> {
    const payload = onlyDbColumns({ ...staffData } as Record<string, unknown>) as Partial<Staff>

    // Normalize phone/CNIC to DB CHECK formats before anything hits the API.
    const phone = normalizePhone(payload.phone_primary)
    if (phone) payload.phone_primary = phone
    else delete payload.phone_primary
    if (payload.whatsapp_number) {
      const wa = normalizePhone(payload.whatsapp_number)
      if (wa) payload.whatsapp_number = wa
    }
    const cnic = normalizeCNIC(payload.cnic_number)
    if (cnic) payload.cnic_number = cnic
    else delete payload.cnic_number

    // Existing CNIC → update that record instead of violating the UNIQUE key.
    if (cnic) {
      const { data: existing, error: fetchErr } = await supabase
        .from('employees')
        .select('id')
        .eq('cnic_number', cnic)
        .maybeSingle()
      if (fetchErr) throw fetchErr
      if (existing) {
        delete payload.emp_no
        const { data, error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw error
        return data as Staff
      }
    }

    // Fresh record: generate emp_no with retry on the UNIQUE race.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!payload.emp_no) payload.emp_no = await nextEmpNo()
      const { data, error } = await supabase
        .from('employees')
        .insert([payload])
        .select()
        .single()
      if (!error) return data as Staff
      // Only retry on emp_no UNIQUE collisions; anything else is fatal.
      if (error.code !== '23505') throw error
      delete payload.emp_no
    }
    throw new Error('Could not allocate a unique employee number. Please retry.')
  },

  async updateStaff(id: string, updates: Partial<Staff>): Promise<Staff> {
    const payload = onlyDbColumns({ ...updates } as Record<string, unknown>) as Partial<Staff>
    if (payload.phone_primary) {
      const phone = normalizePhone(payload.phone_primary)
      if (phone) payload.phone_primary = phone
      else delete payload.phone_primary
    }
    if (payload.cnic_number) {
      const cnic = normalizeCNIC(payload.cnic_number)
      if (cnic) payload.cnic_number = cnic
      else delete payload.cnic_number
    }
    delete payload.id
    delete payload.emp_no // emp_no is immutable once assigned
    const { data, error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Staff
  },

  /**
   * Delete a staff record. Refuses (typed error) when ledger data references
   * the employee — manual_shifts and salary_advances FK to employees without
   * ON DELETE CASCADE on the live schema, so a hard delete would 23503.
   */
  async deleteStaff(id: string): Promise<void> {
    const { data: dependents, error: depErr } = await supabase
      .from('employees')
      .select(
        `id,
         shifts:manual_shifts(employee_id),
         advances:salary_advances(employee_id)`
      )
      .eq('id', id)
      .maybeSingle()
    if (depErr) throw depErr

    const shiftCount = dependents?.shifts?.length ?? 0
    const advanceCount = dependents?.advances?.length ?? 0
    if (shiftCount > 0 || advanceCount > 0) {
      throw new Error(
        `Cannot delete: record has ${shiftCount} shift(s) and ${advanceCount} advance(s). ` +
          'End service instead, or remove the ledger entries first.'
      )
    }

    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) throw error
  },
}
