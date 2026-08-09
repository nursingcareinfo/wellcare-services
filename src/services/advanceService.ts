import { supabase } from '../lib/supabase'

export interface SalaryAdvance {
  id: string
  employee_id: string
  amount_pkr: number
  disbursement_date: string
  payment_method: 'Cash' | 'JazzCash' | 'EasyPesa' | 'Bank'
  status: 'Pending' | 'Settled'
  notes?: string
  created_at: string
}

export const advanceService = {
  async addAdvance(advance: Partial<SalaryAdvance>) {
    const { data, error } = await supabase
      .from('salary_advances')
      .insert([advance])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getAdvancesByEmployee(employeeId: string) {
    const { data, error } = await supabase
      .from('salary_advances')
      .select('*')
      .eq('employee_id', employeeId)
      .order('disbursement_date', { ascending: false })

    if (error) throw error
    return data as SalaryAdvance[]
  },
}
