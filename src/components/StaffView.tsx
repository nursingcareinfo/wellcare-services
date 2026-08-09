import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  UserPlus,
  X,
  Pencil,
  Trash2,
  Ban,
  CalendarDays,
  BookOpenText,
  Banknote,
  RefreshCw,
  Phone,
  BadgeCheck,
  AlertTriangle,
  UserCheck,
  Clock,
  ShieldAlert,
} from 'lucide-react'
import { staffService, type Staff } from '../services/staffService'
import { shiftService } from '../services/shiftService'
import { advanceService, type SalaryAdvance } from '../services/advanceService'
import { patientService } from '../services/patientService'
import { fillRandomStaff } from '../lib/randomData'
import { formatPKR, formatCNICInput, formatPhoneInput, formatNameInput } from '../lib/utils'
import { KARACHI_AREAS, STAFF_CATEGORIES } from '../constants'
import StaffAttendanceCalendarModal from './StaffAttendanceCalendarModal'
import StaffLedgerModal from './StaffLedgerModal'
import { cn } from '../lib/utils'

interface StaffViewProps {
  setActiveView: (view: string) => void
  onSelectPatient: (patientId: string) => void
}

interface PatientOption {
  id: string
  full_name: string
  district?: string
  status?: string
  service_type?: string
}

interface StaffAssignment {
  id: string
  name: string
  shiftType: string
}

const GENDERS = ['Male', 'Female', 'Other'] as const
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'] as const
const RELIGIONS = ['Christian', 'Muslim', 'Hindu', 'Other'] as const
const SHIFT_PREFERENCES = ['Morning', 'Night'] as const
const PAYMENT_METHODS = ['Cash', 'JazzCash', 'EasyPesa', 'Bank'] as const
const END_SERVICE_REASONS = [
  'Resignation',
  'Termination',
  'Contract Ended',
  'Retirement',
  'Deceased',
  'Other',
] as const

type AvailabilityFilter = 'All' | 'Available' | 'On Duty' | 'Blacklisted' | 'Service Ended'
type CategoryFilter = 'All' | 'Action Required' | (typeof STAFF_CATEGORIES)[number]

interface RegisterForm {
  full_name: string
  father_husband_name: string
  cnic_number: string
  phone_primary: string
  whatsapp_number: string
  gender: string
  marital_status: string
  religion: string
  dob: string
  district: string
  complete_address: string
  category: string
  position_applied: string
  experience_years: number
  shift_preference: string
  perShiftRate: number
  preferred_payment_method: string
  is_active: boolean
  is_available: boolean
}

const EMPTY_FORM: RegisterForm = {
  full_name: '',
  father_husband_name: '',
  cnic_number: '',
  phone_primary: '',
  whatsapp_number: '',
  gender: '',
  marital_status: '',
  religion: '',
  dob: '',
  district: '',
  complete_address: '',
  category: 'Nurse',
  position_applied: '',
  experience_years: 0,
  shift_preference: '',
  perShiftRate: 0,
  preferred_payment_method: '',
  is_active: true,
  is_available: true,
}

function calculateAge(dob?: string): number | null {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function is24HourService(serviceType?: string): boolean {
  return /24/i.test(serviceType || '')
}

export default function StaffView({ setActiveView, onSelectPatient }: StaffViewProps) {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('All')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')

  // Register form
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<RegisterForm>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  // Assign shift
  const [assigningStaffId, setAssigningStaffId] = useState<string | null>(null)
  const [assignPatientId, setAssignPatientId] = useState('')
  const [assignShiftType, setAssignShiftType] = useState<'Morning' | 'Night'>('Morning')
  const [isAssigningShift, setIsAssigningShift] = useState(false)
  const [staffAssignments, setStaffAssignments] = useState<Record<string, StaffAssignment>>({})

  // Advance
  const [selectedStaffForAdvance, setSelectedStaffForAdvance] = useState<Staff | null>(null)
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash')
  const [recentAdvances, setRecentAdvances] = useState<SalaryAdvance[]>([])
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false)

  // Edit
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<Staff | null>(null)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editFormData, setEditFormData] = useState<RegisterForm>(EMPTY_FORM)

  // Delete
  const [selectedStaffForDelete, setSelectedStaffForDelete] = useState<Staff | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // End service
  const [selectedStaffForEndService, setSelectedStaffForEndService] = useState<Staff | null>(null)
  const [endServiceDate, setEndServiceDate] = useState(new Date().toISOString().split('T')[0])
  const [endServiceReason, setEndServiceReason] = useState(END_SERVICE_REASONS[0])
  const [endServiceNotes, setEndServiceNotes] = useState('')
  const [isEndingService, setIsEndingService] = useState(false)
  const [isReinstating, setIsReinstating] = useState(false)

  // Attendance / Ledger
  const [selectedStaffForAttendance, setSelectedStaffForAttendance] = useState<Staff | null>(null)
  const [selectedStaffForLedger, setSelectedStaffForLedger] = useState<Staff | null>(null)

  const loadStaff = async () => {
    setLoading(true)
    try {
      const data = await staffService.getAllStaff()
      setStaffList(data)

      // For staff not available, resolve the active assignment (patient name, shift type).
      const assignments: Record<string, StaffAssignment> = {}
      await Promise.all(
        data
          .filter((staff) => staff.id && staff.is_available === false)
          .map(async (staff) => {
            try {
              const shifts = await shiftService.getActiveShiftsForStaff(staff.id)
              const active = shifts?.[0]
              if (active) {
                const patient = active.patient as { full_name?: string } | undefined
                assignments[staff.id] = {
                  id: active.patient_id || '',
                  name: patient?.full_name || 'Assigned',
                  shiftType: active.shift_type || '',
                }
              }
            } catch {
              // Assignment info is optional — silently skip.
            }
          })
      )
      setStaffAssignments(assignments)
    } catch (error) {
      console.error('Error fetching staff:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
    patientService
      .getAllPatients()
      .then((data) => setPatients(data || []))
      .catch((err) => console.error('Error fetching patients:', err))
  }, [])

  const activePatients = useMemo(
    () => patients.filter((p) => p.status === 'Active' && p.full_name),
    [patients]
  )

  const filteredStaff = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return staffList.filter((staff) => {
      if (availabilityFilter === 'Available' && !staff.is_available) return false
      if (availabilityFilter === 'On Duty' && staff.is_available !== false) return false
      if (availabilityFilter === 'Blacklisted' && !staff.is_blacklisted) return false
      if (availabilityFilter === 'Service Ended' && !staff.service_end_date) return false
      if (categoryFilter === 'Action Required') {
        if (!staff.critical_missing_info) return false
      } else if (categoryFilter !== 'All' && staff.category !== categoryFilter) {
        return false
      }
      if (!q) return true
      const haystack = [
        staff.full_name,
        staff.emp_no,
        staff.cnic_number,
        staff.phone_primary,
        staff.district,
        staff.category,
        staff.position_applied,
        staff.father_husband_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [staffList, searchTerm, availabilityFilter, categoryFilter])

  const clearFilters = () => {
    setSearchTerm('')
    setAvailabilityFilter('All')
    setCategoryFilter('All')
  }

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const phoneDigits = formData.phone_primary.replace(/\D/g, '')
    const cnicDigits = formData.cnic_number.replace(/\D/g, '')
    if (!formData.full_name.trim()) return setFormError('Full name is required.')
    if (cnicDigits.length !== 13)
      return setFormError('CNIC must be 13 digits (XXXXX-XXXXXXX-X).')
    if (!/^0?3\d{9}$/.test(phoneDigits))
      return setFormError('Phone must be a valid Pakistani mobile (03XX-XXXXXXX).')
    if (!formData.district) return setFormError('District is required.')

    setIsSubmitting(true)
    try {
      await staffService.createStaff({
        full_name: formData.full_name.trim(),
        father_husband_name: formData.father_husband_name.trim() || undefined,
        cnic_number: formData.cnic_number,
        phone_primary: formData.phone_primary,
        whatsapp_number: formData.whatsapp_number.trim() || undefined,
        gender: formData.gender || undefined,
        marital_status: formData.marital_status || undefined,
        religion: formData.religion || undefined,
        dob: formData.dob || null,
        district: formData.district,
        complete_address: formData.complete_address.trim() || undefined,
        category: formData.category,
        position_applied: formData.position_applied.trim() || undefined,
        experience_years: formData.experience_years || 0,
        shift_preference: formData.shift_preference || undefined,
        // DB stores MONTHLY salary; the form edits the per-shift rate.
        expected_salary_pkr: formData.perShiftRate * 30,
        preferred_payment_method: formData.preferred_payment_method || undefined,
        is_active: formData.is_active,
        is_available: formData.is_available,
        rating: 5.0,
        critical_missing_info:
          !formData.full_name.trim() ||
          cnicDigits.length !== 13 ||
          !/^0?3\d{9}$/.test(phoneDigits),
      })
      alert('Staff registered successfully!')
      setShowForm(false)
      setFormData(EMPTY_FORM)
      loadStaff()
    } catch (error: any) {
      console.error('Error registering staff:', error)
      setFormError(
        error?.message?.includes('phone')
          ? 'Phone number format is invalid.'
          : error?.message || 'Registration failed. Please try again or contact support.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Availability ──────────────────────────────────────────────────────────
  const handleToggleAvailability = async (staff: Staff) => {
    try {
      await staffService.updateStaff(staff.id, { is_available: !staff.is_available })
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_available: !staff.is_available } : s))
      )
    } catch (error) {
      console.error('Error toggling availability:', error)
    }
  }

  // ── Shift assignment ──────────────────────────────────────────────────────
  const handleAssignShift = async (staff: Staff) => {
    if (!assignPatientId || !assigningStaffId) return

    setIsAssigningShift(true)
    try {
      const rate = Math.round((staff.expected_salary_pkr || 0) / 30)
      await shiftService.logShift({
        employee_id: staff.id,
        patient_id: assignPatientId,
        shift_date: new Date().toISOString().split('T')[0],
        shift_type: assignShiftType,
        decided_rate_pkr: rate,
        attendance_status: 'Scheduled',
      })
      await staffService.updateStaff(staff.id, { is_available: false })
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_available: false } : s))
      )
      setAssigningStaffId(null)
      setAssignPatientId('')
    } catch (error: any) {
      console.error('Error assigning shift:', error)
      alert(error?.message || 'Failed to assign shift.')
    } finally {
      setIsAssigningShift(false)
    }
  }

  // ── Advance ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedStaffForAdvance) return
    advanceService
      .getAdvancesByEmployee(selectedStaffForAdvance.id)
      .then((data) => setRecentAdvances(data?.slice(0, 3) || []))
      .catch((err) => console.error('Error loading advances:', err))
  }, [selectedStaffForAdvance])

  const handleGiveAdvance = async () => {
    if (!selectedStaffForAdvance) return
    const amount = parseFloat(advanceAmount)
    if (!amount || amount <= 0) {
      alert('Enter a valid advance amount.')
      return
    }
    setIsSubmittingAdvance(true)
    try {
      await advanceService.addAdvance({
        employee_id: selectedStaffForAdvance.id,
        amount_pkr: amount,
        payment_method: paymentMethod as SalaryAdvance['payment_method'],
        status: 'Pending',
      })
      alert('Advance recorded.')
      setSelectedStaffForAdvance(null)
      setAdvanceAmount('')
      setPaymentMethod('Cash')
    } catch (error) {
      console.error('Error recording advance:', error)
      alert('Failed to record advance.')
    } finally {
      setIsSubmittingAdvance(false)
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  const handleStartEdit = (staff: Staff) => {
    setSelectedStaffForEdit(staff)
    setEditFormData({
      full_name: staff.full_name || '',
      father_husband_name: staff.father_husband_name || '',
      cnic_number: staff.cnic_number || '',
      phone_primary: staff.phone_primary || '',
      whatsapp_number: staff.whatsapp_number || '',
      gender: staff.gender || '',
      marital_status: staff.marital_status || '',
      religion: staff.religion || '',
      dob: staff.dob || '',
      district: staff.district || '',
      complete_address: staff.complete_address || '',
      category: staff.category || 'Nurse',
      position_applied: staff.position_applied || '',
      experience_years: staff.experience_years || 0,
      shift_preference: staff.shift_preference || '',
      perShiftRate: Math.round((staff.expected_salary_pkr || 0) / 30),
      preferred_payment_method: staff.preferred_payment_method || '',
      is_active: staff.is_active ?? true,
      is_available: staff.is_available ?? true,
    })
  }

  const handleEditStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaffForEdit) return
    const phoneDigits = editFormData.phone_primary.replace(/\D/g, '')
    if (phoneDigits && !/^0?3\d{9}$/.test(phoneDigits)) {
      alert('Phone must be a valid Pakistani mobile (03XX-XXXXXXX).')
      return
    }
    const cnicDigits = editFormData.cnic_number.replace(/\D/g, '')
    if (editFormData.cnic_number && cnicDigits.length !== 13) {
      alert('CNIC must be 13 digits (XXXXX-XXXXXXX-X).')
      return
    }

    setIsSubmittingEdit(true)
    try {
      await staffService.updateStaff(selectedStaffForEdit.id, {
        full_name: editFormData.full_name.trim() || undefined,
        father_husband_name: editFormData.father_husband_name.trim() || undefined,
        cnic_number: editFormData.cnic_number || undefined,
        phone_primary: editFormData.phone_primary || undefined,
        whatsapp_number: editFormData.whatsapp_number.trim() || undefined,
        gender: editFormData.gender || undefined,
        marital_status: editFormData.marital_status || undefined,
        religion: editFormData.religion || undefined,
        dob: editFormData.dob || null,
        district: editFormData.district || undefined,
        complete_address: editFormData.complete_address.trim() || undefined,
        category: editFormData.category || undefined,
        position_applied: editFormData.position_applied.trim() || undefined,
        experience_years: editFormData.experience_years || 0,
        shift_preference: editFormData.shift_preference || undefined,
        expected_salary_pkr: editFormData.perShiftRate * 30,
        preferred_payment_method: editFormData.preferred_payment_method || undefined,
        is_active: editFormData.is_active,
        is_available: editFormData.is_available,
      })
      alert('Profile updated.')
      setSelectedStaffForEdit(null)
      loadStaff()
    } catch (error: any) {
      console.error('Error updating staff:', error)
      alert(error?.message || 'Update failed.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteStaff = async () => {
    if (!selectedStaffForDelete) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await staffService.deleteStaff(selectedStaffForDelete.id)
      setStaffList((prev) => prev.filter((s) => s.id !== selectedStaffForDelete.id))
      setSelectedStaffForDelete(null)
    } catch (error: any) {
      console.error('Error deleting staff:', error)
      setDeleteError(error?.message || 'Delete failed.')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Blacklist / End service ───────────────────────────────────────────────
  const handleToggleBlacklist = async (staff: Staff) => {
    const next = !staff.is_blacklisted
    if (next && !confirm(`Blacklist ${staff.full_name}?`)) return
    try {
      await staffService.updateStaff(staff.id, { is_blacklisted: next })
      setStaffList((prev) =>
        prev.map((s) => (s.id === staff.id ? { ...s, is_blacklisted: next } : s))
      )
    } catch (error) {
      console.error('Error toggling blacklist:', error)
    }
  }

  const handleEndService = async () => {
    if (!selectedStaffForEndService) return
    setIsEndingService(true)
    try {
      await staffService.updateStaff(selectedStaffForEndService.id, {
        service_end_date: endServiceDate,
        service_end_reason: endServiceReason,
        service_end_notes: endServiceNotes.trim() || null,
        is_active: false,
        is_available: false,
      })
      setSelectedStaffForEndService(null)
      setEndServiceNotes('')
      loadStaff()
    } catch (error) {
      console.error('Error ending service:', error)
      alert('Failed to end service.')
    } finally {
      setIsEndingService(false)
    }
  }

  const handleReinstate = async (staff: Staff) => {
    if (!confirm(`Reinstate ${staff.full_name}?`)) return
    setIsReinstating(true)
    try {
      await staffService.updateStaff(staff.id, {
        service_end_date: null,
        service_end_reason: null,
        service_end_notes: null,
        is_active: true,
        is_available: true,
      })
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === staff.id
            ? {
                ...s,
                service_end_date: null,
                service_end_reason: null,
                service_end_notes: null,
                is_active: true,
                is_available: true,
              }
            : s
        )
      )
    } catch (error) {
      console.error('Error reinstating staff:', error)
      alert('Failed to reinstate.')
    } finally {
      setIsReinstating(false)
    }
  }

  const updateForm = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }))

  const updateEditForm = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) =>
    setEditFormData((prev) => ({ ...prev, [key]: value }))

  // ── Shared field renderers ────────────────────────────────────────────────
  const inputClass =
    'input-field w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'

  const renderFormFields = (
    data: RegisterForm,
    set: (key: keyof RegisterForm, value: any) => void,
    showDobAge: boolean
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Full Name *
        </label>
        <input
          className={inputClass}
          value={data.full_name}
          onChange={(e) => set('full_name', formatNameInput(e.target.value))}
          placeholder="e.g. Ayesha Khan"
          required
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Father / Husband Name
        </label>
        <input
          className={inputClass}
          value={data.father_husband_name}
          onChange={(e) => set('father_husband_name', formatNameInput(e.target.value))}
          placeholder="e.g. Muhammad Khan"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          CNIC *
        </label>
        <input
          className={inputClass}
          value={data.cnic_number}
          onChange={(e) => set('cnic_number', formatCNICInput(e.target.value))}
          placeholder="42101-1234567-1"
          inputMode="numeric"
          required
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Phone *
        </label>
        <input
          className={inputClass}
          value={data.phone_primary}
          onChange={(e) => set('phone_primary', formatPhoneInput(e.target.value))}
          placeholder="03XX-XXXXXXX"
          inputMode="tel"
          required
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          WhatsApp
        </label>
        <input
          className={inputClass}
          value={data.whatsapp_number}
          onChange={(e) => set('whatsapp_number', formatPhoneInput(e.target.value))}
          placeholder="03XX-XXXXXXX"
          inputMode="tel"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Gender
        </label>
        <select
          className={inputClass}
          value={data.gender}
          onChange={(e) => set('gender', e.target.value)}
        >
          <option value="">Select Gender</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Marital Status
        </label>
        <select
          className={inputClass}
          value={data.marital_status}
          onChange={(e) => set('marital_status', e.target.value)}
        >
          <option value="">Select...</option>
          {MARITAL_STATUSES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Religion
        </label>
        <select
          className={inputClass}
          value={data.religion}
          onChange={(e) => set('religion', e.target.value)}
        >
          <option value="">Select Religion</option>
          {RELIGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Date of Birth {showDobAge && data.dob ? `(${calculateAge(data.dob) ?? '?'} yrs)` : ''}
        </label>
        <input
          type="date"
          className={inputClass}
          value={data.dob}
          onChange={(e) => set('dob', e.target.value)}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          District *
        </label>
        <select
          className={inputClass}
          value={data.district}
          onChange={(e) => set('district', e.target.value)}
          required
        >
          <option value="">Select District</option>
          {KARACHI_AREAS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Complete Address
        </label>
        <input
          className={inputClass}
          value={data.complete_address}
          onChange={(e) => set('complete_address', e.target.value)}
          placeholder="House, street, block, area"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Category
        </label>
        <select
          className={inputClass}
          value={data.category}
          onChange={(e) => set('category', e.target.value)}
        >
          {STAFF_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Position Applied
        </label>
        <input
          className={inputClass}
          value={data.position_applied}
          onChange={(e) => set('position_applied', formatNameInput(e.target.value))}
          placeholder="e.g. Staff Nurse"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Experience (years)
        </label>
        <input
          type="number"
          min={0}
          max={60}
          className={inputClass}
          value={data.experience_years || ''}
          onChange={(e) => set('experience_years', Number(e.target.value) || 0)}
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Shift Preference
        </label>
        <select
          className={inputClass}
          value={data.shift_preference}
          onChange={(e) => set('shift_preference', e.target.value)}
        >
          <option value="">Any</option>
          {SHIFT_PREFERENCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Per-Shift Rate (PKR) — stored monthly (×30)
        </label>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={data.perShiftRate || ''}
          onChange={(e) => set('perShiftRate', Number(e.target.value) || 0)}
          placeholder="e.g. 1000"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
          Preferred Payment Method
        </label>
        <select
          className={inputClass}
          value={data.preferred_payment_method}
          onChange={(e) => set('preferred_payment_method', e.target.value)}
        >
          <option value="">Select...</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
            className="accent-emerald-600"
          />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={data.is_available}
            onChange={(e) => set('is_available', e.target.checked)}
            className="accent-emerald-600"
          />
          Available
        </label>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-gray-800 dark:text-neutral-100">
            Staff Management
          </h2>
          <p className="text-[10px] text-[var(--color-ink-dim)] uppercase tracking-widest font-bold mt-0.5">
            Manage and register Karachi medical professionals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStaff}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => {
              setShowForm((s) => !s)
              setFormError(null)
            }}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            {showForm ? <X size={14} /> : <UserPlus size={14} />}
            {showForm ? 'Cancel' : 'Register Staff'}
          </button>
        </div>
      </div>

      {/* Register form */}
      {showForm && (
        <form
          onSubmit={handleRegisterStaff}
          className="glass-card p-6 rounded-2xl border border-[var(--color-border)]"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
              Register New Professional
            </h3>
            <button
              type="button"
              onClick={() => setFormData((prev) => fillRandomStaff({ ...prev }))}
              className="btn-secondary px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            >
              Fill Random
            </button>
          </div>
          {renderFormFields(formData, updateForm, true)}
          {formError && (
            <p className="mt-4 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle size={13} /> {formError}
            </p>
          )}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Professional'}
            </button>
          </div>
        </form>
      )}

      {/* Search + filters */}
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-dim)]"
          />
          <input
            className="input-field w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--color-border)] text-sm"
            placeholder="Search staff by name or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(['All', 'Available', 'On Duty', 'Blacklisted', 'Service Ended'] as AvailabilityFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setAvailabilityFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all',
                  availabilityFilter === f
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-neutral-900 border-[var(--color-border)] text-[var(--color-ink-dim)] hover:border-emerald-400'
                )}
              >
                {f}
              </button>
            )
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(['All', 'Action Required', ...STAFF_CATEGORIES] as CategoryFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all',
                categoryFilter === c
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-neutral-900 border-[var(--color-border)] text-[var(--color-ink-dim)] hover:border-emerald-400'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Staff grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-[var(--color-border)]">
          <UserCheck size={40} className="mx-auto mb-3 text-[var(--color-ink-dim)] opacity-40" />
          <p className="text-sm font-bold text-[var(--color-ink-dim)]">
            {staffList.length === 0
              ? 'No staff registered yet. Click Register Staff to add the first professional.'
              : 'No staff match the current filters.'}
          </p>
          {staffList.length > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 btn-secondary px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => {
            const assignment = staffAssignments[staff.id]
            const age = calculateAge(staff.dob)
            const isOnDuty = staff.is_available === false
            return (
              <div
                key={staff.id}
                className={cn(
                  'glass-card rounded-2xl border p-5 transition-all relative',
                  staff.critical_missing_info
                    ? 'border-red-300 dark:border-red-900 ring-1 ring-red-200 dark:ring-red-900'
                    : 'border-[var(--color-border)]',
                  staff.is_blacklisted && 'opacity-80'
                )}
              >
                {/* Status ribbons */}
                {staff.service_end_date && (
                  <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-neutral-700 text-white text-[8px] font-black uppercase tracking-widest">
                    Service Ended
                  </div>
                )}
                {staff.is_blacklisted && (
                  <div className="absolute -top-2 right-4 px-2 py-0.5 rounded-full bg-red-600 text-white text-[8px] font-black uppercase tracking-widest">
                    Blacklisted
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-gray-800 dark:text-neutral-100 truncate flex items-center gap-1.5">
                      {staff.full_name || 'Unnamed'}
                      {staff.is_verified && (
                        <BadgeCheck size={14} className="text-emerald-500 shrink-0" />
                      )}
                    </h3>
                    <p className="text-[10px] font-mono text-[var(--color-ink-dim)] mt-0.5">
                      {staff.emp_no || 'No ID'} · {staff.category || 'General'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {age !== null && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
                          {age} yrs
                        </span>
                      )}
                      {staff.district && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-bg)] dark:bg-neutral-900 text-[var(--color-ink-dim)] text-[9px] font-bold uppercase tracking-wider">
                          {staff.district}
                        </span>
                      )}
                      {staff.position_applied && (
                        <span className="px-2 py-0.5 rounded-md bg-[var(--color-bg)] dark:bg-neutral-900 text-[var(--color-ink-dim)] text-[9px] font-bold uppercase tracking-wider">
                          {staff.position_applied}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleAvailability(staff)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-all',
                        staff.is_available
                          ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      )}
                    >
                      {isOnDuty ? 'On Duty' : 'Available'}
                    </button>
                    <span className="text-[9px] font-mono text-[var(--color-ink-dim)]">
                      {staff.phone_primary || '—'}
                    </span>
                  </div>
                </div>

                {staff.critical_missing_info && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-[10px] font-bold flex items-center gap-1.5">
                    <AlertTriangle size={12} /> Action required — incomplete profile
                  </div>
                )}

                {/* On-duty / assignment panel */}
                {isOnDuty && assignment && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-[10px] font-bold flex flex-wrap items-center gap-2">
                    <Clock size={12} className="text-amber-600 dark:text-amber-300" />
                    <span className="text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      {assignment.shiftType || 'Assigned'} shift
                    </span>
                    <button
                      onClick={() => {
                        if (assignment.id) {
                          onSelectPatient(assignment.id)
                          setActiveView('patients')
                        }
                      }}
                      className="text-emerald-700 dark:text-emerald-300 underline hover:no-underline truncate max-w-full"
                    >
                      {assignment.name}
                    </button>
                  </div>
                )}

                {/* Relative info */}
                {staff.relative_info &&
                  (staff.relative_info as any)?.name && (
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-[var(--color-ink-dim)]">
                      <Phone size={11} />
                      <span>
                        {(staff.relative_info as any).name}
                        {(staff.relative_info as any).phone
                          ? ` · ${(staff.relative_info as any).phone}`
                          : ''}
                        {(staff.relative_info as any).relationship
                          ? ` · ${(staff.relative_info as any).relationship}`
                          : ''}
                      </span>
                    </div>
                  )}

                {/* Per-shift rate */}
                {(staff.expected_salary_pkr || 0) > 0 && (
                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="text-[var(--color-ink-dim)] uppercase tracking-wider font-bold">
                      Monthly {formatPKR(staff.expected_salary_pkr || 0)}
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-300 font-bold">
                      {formatPKR(Math.round((staff.expected_salary_pkr || 0) / 30))}/shift
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {staff.is_available ? (
                    <button
                      onClick={() => {
                        setAssigningStaffId((cur) => (cur === staff.id ? null : staff.id))
                        setAssignPatientId('')
                      }}
                      className="btn-primary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                    >
                      Assign Shift
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleAvailability(staff)}
                      className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                    >
                      Make Available
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedStaffForAttendance(staff)}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <CalendarDays size={11} /> Attendance
                  </button>
                  <button
                    onClick={() => setSelectedStaffForLedger(staff)}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <BookOpenText size={11} /> Ledger
                  </button>
                  <button
                    onClick={() => setSelectedStaffForAdvance(staff)}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <Banknote size={11} /> Advance
                  </button>
                  <button
                    onClick={() => handleStartEdit(staff)}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleBlacklist(staff)}
                    className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <Ban size={11} /> {staff.is_blacklisted ? 'Unblacklist' : 'Blacklist'}
                  </button>
                  {staff.service_end_date ? (
                    <button
                      onClick={() => handleReinstate(staff)}
                      disabled={isReinstating}
                      className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 disabled:opacity-50"
                    >
                      <UserCheck size={11} /> Reinstate
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedStaffForEndService(staff)
                        setEndServiceDate(new Date().toISOString().split('T')[0])
                        setEndServiceReason(END_SERVICE_REASONS[0])
                        setEndServiceNotes('')
                      }}
                      className="btn-secondary px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                    >
                      <ShieldAlert size={11} /> End Service
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedStaffForDelete(staff)
                      setDeleteError(null)
                    }}
                    className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 hover:bg-red-100 flex items-center gap-1"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </div>

                {/* Inline assign-shift panel */}
                {assigningStaffId === staff.id && (
                  <div className="mt-4 p-4 rounded-xl bg-[var(--color-bg)] dark:bg-neutral-900 border border-[var(--color-border)] space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-ink-dim)]">
                      Assign to patient
                    </p>
                    <select
                      className={inputClass}
                      value={assignPatientId}
                      onChange={(e) => setAssignPatientId(e.target.value)}
                    >
                      <option value="">Select patient...</option>
                      {activePatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} — {p.district || 'N/A'} (
                          {p.service_type || 'unspecified'})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      {(['Morning', 'Night'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setAssignShiftType(t)}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all',
                            assignShiftType === t
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-neutral-900 border-[var(--color-border)] text-[var(--color-ink-dim)]'
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-ink-dim)] font-bold uppercase tracking-wider">
                        Rate
                      </span>
                      <span className="font-mono font-bold">
                        {formatPKR(Math.round((staff.expected_salary_pkr || 0) / 30))}
                        {is24HourService(
                          activePatients.find((p) => p.id === assignPatientId)?.service_type
                        ) && (
                          <span className="ml-1.5 text-emerald-600 dark:text-emerald-300 text-[9px] uppercase tracking-wider">
                            24h patient
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAssignShift(staff)}
                        disabled={isAssigningShift || !assignPatientId}
                        className="btn-primary flex-1 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                      >
                        {isAssigningShift ? 'Assigning...' : 'Assign Shift'}
                      </button>
                      <button
                        onClick={() => setAssigningStaffId(null)}
                        className="btn-secondary px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Advance modal */}
      {selectedStaffForAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest">
                Advance — {selectedStaffForAdvance.full_name}
              </h3>
              <button onClick={() => setSelectedStaffForAdvance(null)} className="text-[var(--color-ink-dim)]">
                <X size={18} />
              </button>
            </div>
            <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
              Amount (PKR)
            </label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
              placeholder="e.g. 5000"
              autoFocus
            />
            <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1 mt-4">
              Payment Method
            </label>
            <select
              className={inputClass}
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {recentAdvances.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-ink-dim)] mb-2">
                  Recent Advances
                </p>
                <div className="space-y-1.5">
                  {recentAdvances.map((a) => (
                    <div
                      key={a.id}
                      className="flex justify-between items-center px-3 py-2 rounded-lg bg-[var(--color-bg)] dark:bg-neutral-900 text-[11px]"
                    >
                      <span className="font-mono font-bold">{formatPKR(a.amount_pkr)}</span>
                      <span className="text-[var(--color-ink-dim)] uppercase tracking-wider">
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedStaffForAdvance(null)}
                className="btn-secondary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleGiveAdvance}
                disabled={isSubmittingAdvance}
                className="btn-primary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                {isSubmittingAdvance ? 'Saving...' : 'Confirm Disbursement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {selectedStaffForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleEditStaff}
            className="glass-card w-full max-w-3xl rounded-2xl border border-[var(--color-border)] p-6 my-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest">
                Edit — {selectedStaffForEdit.full_name}
              </h3>
              <button onClick={() => setSelectedStaffForEdit(null)} className="text-[var(--color-ink-dim)]">
                <X size={18} />
              </button>
            </div>
            {renderFormFields(editFormData, updateEditForm, true)}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedStaffForEdit(null)}
                className="btn-secondary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="btn-primary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
              >
                {isSubmittingEdit ? 'Saving...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete modal */}
      {selectedStaffForDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-[var(--color-border)] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 flex items-center justify-center text-red-600 dark:text-red-400">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black">Delete staff record?</h3>
                <p className="text-[11px] text-[var(--color-ink-dim)]">
                  {selectedStaffForDelete.full_name} ({selectedStaffForDelete.emp_no})
                </p>
              </div>
            </div>
            <p className="text-[11px] text-[var(--color-ink-dim)] leading-relaxed">
              Records with shifts or advances cannot be deleted — end service instead. This action
              is permanent.
            </p>
            {deleteError && (
              <p className="mt-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-[11px] font-bold">
                {deleteError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedStaffForDelete(null)}
                className="btn-secondary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStaff}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End service modal */}
      {selectedStaffForEndService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md rounded-2xl border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest">
                End Service — {selectedStaffForEndService.full_name}
              </h3>
              <button
                onClick={() => setSelectedStaffForEndService(null)}
                className="text-[var(--color-ink-dim)]"
              >
                <X size={18} />
              </button>
            </div>
            <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1">
              End Date
            </label>
            <input
              type="date"
              className={inputClass}
              value={endServiceDate}
              onChange={(e) => setEndServiceDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
            <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1 mt-4">
              Reason
            </label>
            <select
              className={inputClass}
              value={endServiceReason}
              onChange={(e) => setEndServiceReason(e.target.value)}
            >
              {END_SERVICE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <label className="block text-[10px] uppercase tracking-widest font-black text-[var(--color-ink-dim)] mb-1 mt-4">
              Notes
            </label>
            <textarea
              className={inputClass}
              rows={3}
              value={endServiceNotes}
              onChange={(e) => setEndServiceNotes(e.target.value)}
              placeholder="Optional notes..."
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedStaffForEndService(null)}
                className="btn-secondary px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleEndService}
                disabled={isEndingService || !endServiceDate}
                className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {isEndingService ? 'Saving...' : 'End Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Child modals */}
      {selectedStaffForAttendance && (
        <StaffAttendanceCalendarModal
          staffId={selectedStaffForAttendance.id}
          staffName={selectedStaffForAttendance.full_name || ''}
          empNo={selectedStaffForAttendance.emp_no || ''}
          expectedSalary={selectedStaffForAttendance.expected_salary_pkr}
          onClose={() => setSelectedStaffForAttendance(null)}
        />
      )}
      {selectedStaffForLedger && (
        <StaffLedgerModal staff={selectedStaffForLedger} onClose={() => setSelectedStaffForLedger(null)} />
      )}
    </div>
  )
}
