import { supabase } from '../lib/supabase'

export interface ManualShift {
  id: string
  employee_id: string
  patient_id: string
  shift_date: string
  shift_type: 'Morning' | 'Night'
  decided_rate_pkr: number
  attendance_status: 'Scheduled' | 'Completed' | 'Abandoned'
  penalty_applied: boolean
}

export const shiftService = {
  async getShiftsByMonth(year: number, month: number) {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('manual_shifts')
      .select('*, employee:employee_id(full_name), patient:patient_id(full_name)')
      .gte('shift_date', startDate)
      .lte('shift_date', endDate)
      .order('shift_date', { ascending: true })

    if (error) throw error
    return data
  },

  async logShift(shift: Partial<ManualShift>) {
    const { data, error } = await supabase.from('manual_shifts').insert([shift]).select().single()

    if (error) throw error
    return data
  },

  async updateShiftStatus(
    id: string,
    status: 'Completed' | 'Abandoned',
    penaltyApplied: boolean = false
  ) {
    const { data, error } = await supabase
      .from('manual_shifts')
      .update({ attendance_status: status, penalty_applied: penaltyApplied })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getActiveShiftsForStaff(employeeId: string) {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('manual_shifts')
      .select('*, patient:patient_id(full_name, district, service_type)')
      .eq('employee_id', employeeId)
      .eq('shift_date', today)
      .in('attendance_status', ['Scheduled', 'Completed'])

    if (error) throw error
    return data || []
  },

  async getShiftsByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('manual_shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .order('shift_date', { ascending: false })

    if (error) throw error
    return data as ManualShift[]
  },

  async getShiftsByPatient(patientId: string) {
    const { data, error } = await supabase
      .from('manual_shifts')
      .select('*, employee:employee_id(id, is_available)')
      .eq('patient_id', patientId)
      .in('attendance_status', ['Scheduled'])

    if (error) throw error
    return data || []
  },

  async unassignPatientShifts(patientId: string) {
    const shifts = await this.getShiftsByPatient(patientId)
    for (const shift of shifts) {
      await supabase
        .from('manual_shifts')
        .update({ attendance_status: 'Abandoned' })
        .eq('id', shift.id)

      if (shift.employee?.id) {
        await supabase
          .from('employees')
          .update({ is_available: true })
          .eq('id', shift.employee.id)
      }
    }
  },

  async getPatientAssignments(patientIds: string[]) {
    if (patientIds.length === 0) return []
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('manual_shifts')
      .select(
        `employee_id, patient_id, shift_type, decided_rate_pkr,
         employee:employee_id(full_name, expected_salary_pkr)`
      )
      .in('patient_id', patientIds)
      .gte('shift_date', today)
      .in('attendance_status', ['Scheduled', 'Completed'])
      .order('shift_date', { ascending: true })

    if (error) throw error

    // Deduplicate: keep only the earliest upcoming shift per patient + shift_type
    const seen = new Set<string>()
    const unique: any[] = []
    for (const row of data || []) {
      const key = `${row.patient_id}:${row.shift_type}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(row)
      }
    }
    return unique
  },
}
