import { supabase } from '../lib/supabase'

export interface AttendanceRecord {
  id: string
  employee_id: string
  attendance_date: string
  status: 'Present' | 'Absent' | 'Late' | 'Half-Day' | 'Day' | 'Night'
  notes?: string
}

export const attendanceService = {
  async getMonthAttendance(year: number, month: number) {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (error) throw error
    return data || []
  },

  async upsertAttendance(record: Partial<AttendanceRecord>) {
    const { data, error } = await supabase
      .from('staff_attendance')
      .upsert(record, { onConflict: 'employee_id,attendance_date' })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getStaffMonthAttendance(employeeId: string, year: number, month: number) {
    const startDate = new Date(year, month, 1).toISOString().split('T')[0]
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('staff_attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)

    if (error) throw error
    return data || []
  },

  async deleteAttendance(employeeId: string, date: string) {
    const { error } = await supabase
      .from('staff_attendance')
      .delete()
      .eq('employee_id', employeeId)
      .eq('attendance_date', date)

    if (error) throw error
  },
}
