/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StaffCategory = 'Nurse' | 'Attendant' | 'Caretaker' | 'Baby Sitter' | 'Doctor'
export type StaffDesignation = 'RN' | 'BSN' | 'Midwife' | 'ICU/Anes' | 'Attendant'
export type PaymentMethod = 'Cash' | 'JazzCash' | 'EasyPesa' | 'Bank'
export type PatientStatus = 'Active' | 'Pending' | 'Completed' | 'Cancelled'
export type ServiceType = '24hr' | '12hr' | '8hr'
export type ShiftType = 'Day' | 'Night' | 'Full'

export interface Staff {
  id: string
  fullName: string
  cnic: string
  gender: 'Male' | 'Female' | 'Other'
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed'
  dateOfBirth?: string
  category: StaffCategory
  designation: StaffDesignation
  phonePrimary: string
  whatsappNumber: string
  email?: string
  areaTown: string
  completeAddress: string
  rating: number
  experienceYears: number
  skills: string[]
  isAvailable: boolean
  isActive: boolean
  isVerified: boolean
  preferredPayment: PaymentMethod
  expectedSalary?: number
  dayShiftRate?: number
  nightShiftRate?: number
  acknowledgmentSigned: boolean
  service_end_date?: string | null
  service_end_reason?: string | null
  service_end_notes?: string | null
  createdAt: any
  updatedAt: any
}

export interface Patient {
  id: string
  fullName: string
  cnic: string
  dateOfBirth: string
  gender: 'Male' | 'Female' | 'Other'
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed'
  mobileNumber: string
  areaTown: string
  completeAddress: string
  primaryDiagnosis: string
  currentMedications: string[]
  allergies: string[]
  serviceType: ServiceType
  shiftType: ShiftType
  startDate: string
  duration: string
  status: PatientStatus
  assignedStaffId?: string
  monthlyPackage: number
  createdAt: any
  updatedAt: any
}

export interface ShiftRow {
  id: string
  patientId: string
  staffId: string
  date: string
  salary: number
  isCompleted: boolean
  isPaid: boolean
  createdAt: any
}

export type InvoiceStatus = 'Unpaid' | 'Paid' | 'Cancelled'

export interface PatientInvoice {
  id: string
  patient_id: string
  period_start: string
  period_end: string
  amount: number
  status: InvoiceStatus
  paid_at: string | null
  notes: string | null
  created_at: string
}

export interface FinancialRecord {
  id: string
  patientId: string
  month: string // YYYY-MM
  revenue: number
  totalSalaries: number
  margin: number
}
