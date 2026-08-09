/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  ClipboardList,
  Clock,
  MapPin,
  User,
  UserX,
  CreditCard,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Receipt,
  FileText,
  MessageSquare,
  Pencil,
  Package,
  X,
  XCircle,
} from 'lucide-react'
import type { Patient, PatientInvoice, PatientStatus } from '../types'
import { cn, formatPKR, formatNameInput, formatCNICInput, formatPhoneInput } from '../lib/utils'
import { fillRandomPatient } from '../lib/randomData'
import {
  patientService,
  patientInvoiceService,
  patientIntakeService,
  equipmentService,
  getCurrentPeriod,
} from '../services/patientService'
import type { PatientEquipment } from '../services/patientService'
import { shiftService } from '../services/shiftService'
import { staffService } from '../services/staffService'

export default function PatientView({
  highlightedPatientId,
  onClearHighlight,
}: {
  highlightedPatientId?: string | null
  onClearHighlight?: () => void
}) {
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Discontinued'>(
    'All'
  )
  const [showForm, setShowForm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [invoices, setInvoices] = useState<Record<string, PatientInvoice[]>>({})
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set())
  const [assignments, setAssignments] = useState<Record<string, any[]>>({})
  const [intakeStatus, setIntakeStatus] = useState<Record<string, boolean>>({})

  const [availableStaff, setAvailableStaff] = useState<any[]>([])
  const [assigningSlot, setAssigningSlot] = useState<string | null>(null)
  const [assigningStaffId, setAssigningStaffId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)

  const [editPatient, setEditPatient] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState({
    patient_name: '',
    cnic: '',
    mobile_number: '',
    district: '',
    complete_address: '',
    service_type: '24hr',
    monthly_package_pkr: '',
    status: 'Active' as 'Active' | 'Pending' | 'Completed' | 'Cancelled',
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const [equipment, setEquipment] = useState<Record<string, PatientEquipment[]>>({})
  const [expandedEquipment, setExpandedEquipment] = useState<Set<string>>(new Set())
  const [showEquipForm, setShowEquipForm] = useState<string | null>(null)
  const [equipForm, setEquipForm] = useState({
    item_name: '',
    quantity: 1,
    rental_rate: '',
    rate_period: 'monthly' as 'daily' | 'monthly',
    rented_at: new Date().toISOString().split('T')[0],
  })
  const [isAddingEquip, setIsAddingEquip] = useState(false)
  const [isReturningEquip, setIsReturningEquip] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    cnic: '',
    mobile_number: '',
    district: '',
    complete_address: '',
    service_type: '12h_day',
    monthly_package_pkr: '',
    status: 'Pending' as 'Active' | 'Pending' | 'Completed' | 'Cancelled',
  })

  const [selectedPatientForEndService, setSelectedPatientForEndService] = useState<any | null>(null)
  const [endServiceDate, setEndServiceDate] = useState('')
  const [endServiceReason, setEndServiceReason] = useState('')
  const [endServiceNotes, setEndServiceNotes] = useState('')
  const [isEndingService, setIsEndingService] = useState(false)

  const loadPatients = async () => {
    try {
      const data = await patientService.getAllPatients()
      setPatients(data)
      await autoGenerateInvoices(data)
      await Promise.all([
        loadAssignments(data.map((p: any) => p.id)),
        loadIntakeStatus(data),
        loadEquipment(data.map((p: any) => p.id)),
      ])
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadEquipment(patientIds: string[]) {
    try {
      const results = await Promise.all(patientIds.map((id) => equipmentService.getForPatient(id)))
      const grouped: Record<string, PatientEquipment[]> = {}
      for (let i = 0; i < patientIds.length; i++) {
        grouped[patientIds[i]] = results[i]
      }
      setEquipment(grouped)
    } catch (error) {
      console.error('Error loading equipment:', error)
    }
  }

  async function loadIntakeStatus(patientsList: any[]) {
    try {
      const phones = patientsList.map((p: any) => p.mobile_number).filter(Boolean)
      const cnics = patientsList.map((p: any) => p.cnic).filter(Boolean)
      const intakes = await patientIntakeService.getIntakeStatusByPhone(phones, cnics)
      const status: Record<string, boolean> = {}
      for (const intake of intakes) {
        const match = patientsList.find(
          (p: any) =>
            (p.mobile_number && intake.mobile === p.mobile_number) ||
            (p.cnic && intake.cnic === p.cnic)
        )
        if (match && intake.terms_accepted) {
          status[match.id] = true
        }
      }
      setIntakeStatus(status)
    } catch (error) {
      console.error('Error loading intake status:', error)
    }
  }

  async function loadAssignments(patientIds: string[]) {
    try {
      const data = await shiftService.getPatientAssignments(patientIds)
      const grouped: Record<string, any[]> = {}
      for (const row of data) {
        if (!grouped[row.patient_id]) grouped[row.patient_id] = []
        grouped[row.patient_id].push(row)
      }
      setAssignments(grouped)
    } catch (error) {
      console.error('Error loading assignments:', error)
    }
  }

  async function autoGenerateInvoices(patientsList: any[]) {
    const activePatients = patientsList.filter((p) => p.status === 'Active')
    if (activePatients.length === 0) return

    const { periodStart } = getCurrentPeriod()

    for (const patient of activePatients) {
      const existing = await patientInvoiceService.getInvoicesForPatient(patient.id)
      const hasInvoice = existing.some((inv) => inv.period_start === periodStart)
      if (!hasInvoice) {
        await patientInvoiceService.generateInvoice(patient.id, patient.monthly_package_pkr)
      }
    }

    const allIds = patientsList.map((p) => p.id)
    const allInvoices = await patientInvoiceService.getInvoicesForPatients(allIds)
    const grouped: Record<string, PatientInvoice[]> = {}
    for (const inv of allInvoices) {
      if (!grouped[inv.patient_id]) grouped[inv.patient_id] = []
      grouped[inv.patient_id].push(inv)
    }
    setInvoices(grouped)
  }

  useEffect(() => {
    loadPatients()
    staffService
      .getAvailableStaff()
      .then(setAvailableStaff)
      .catch((err) => {
        console.error('Error fetching available staff:', err)
      })
  }, [])

  // Scroll to highlighted patient when navigating from staff card
  useEffect(() => {
    if (!highlightedPatientId || patients.length === 0) return

    const el = document.getElementById(`patient-card-${highlightedPatientId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-black')
      const timer = setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-black')
      }, 3000)
      onClearHighlight?.()
      return () => clearTimeout(timer)
    }
  }, [highlightedPatientId, patients, onClearHighlight])

  const handleEditSubmit = async () => {
    if (!editPatient) return
    setIsSavingEdit(true)
    try {
      const { full_name, ...updateData } = editFormData
      await patientService.updatePatient(editPatient.id, {
        ...updateData,
        monthly_package_pkr: parseFloat(editFormData.monthly_package_pkr) || 0,
      })
      setEditPatient(null)
      loadPatients()
    } catch (error) {
      console.error('Error updating patient:', error)
      alert('Failed to update patient')
    } finally {
      setIsSavingEdit(false)
    }
  }

  function openEditModal(patient: any) {
    setEditPatient(patient)
    setEditFormData({
      patient_name: patient.patient_name || patient.full_name || '',
      cnic: patient.cnic || '',
      mobile_number: patient.mobile_number || '',
      district: patient.district || '',
      complete_address: patient.complete_address || '',
      service_type: patient.service_type || '24hr',
      monthly_package_pkr: (patient.monthly_package_pkr || 0).toString(),
      status: patient.status || 'Active',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const monthlyPkg = parseFloat(formData.monthly_package_pkr)
      if (monthlyPkg > 99_999_999) {
        alert('Monthly package too large. Maximum is 99,999,999 PKR.')
        setIsSubmitting(false)
        return
      }
      // patients.full_name is a GENERATED column (derived from patient_name) —
      // inserts must target patient_name, not full_name (edit flow already does).
      const { start_date, full_name, ...patientData } = formData
      await patientService.createPatient({
        ...patientData,
        patient_name: full_name,
        monthly_package_pkr: monthlyPkg || 0,
      })
      alert('Patient registered successfully!')
      setShowForm(false)
      setFormData({
        full_name: '',
        cnic: '',
        mobile_number: '',
        district: '',
        complete_address: '',
        service_type: '12h_day',
        monthly_package_pkr: '',
        status: 'Pending',
      })
      loadPatients()
    } catch (error) {
      console.error('Error registering patient:', error)
      alert('Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="text-emerald-500 animate-spin" size={40} />
        <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black">
          Syncing Residence Hub...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-6 rounded-xl shadow-2xl dark:shadow-none">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-neutral-100 uppercase tracking-tighter">
            Patient Admissions
          </h2>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black mt-1">
            Karachi Active Households Ledger
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary flex items-center gap-2 px-6"
        >
          {showForm ? (
            'Cancel Registration'
          ) : (
            <>
              <Plus size={16} /> Register Patient
            </>
          )}
        </button>
      </div>

      {/* Status Filter Tags */}
      <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-hide">
        {(['All', 'Active', 'Pending', 'Discontinued'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap border',
              statusFilter === filter
                ? filter === 'Discontinued'
                  ? 'bg-red-500/20 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-500/30 dark:border-red-800'
                  : 'bg-emerald-500/20 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-800'
                : 'bg-gray-100 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-300 border-gray-200 dark:border-neutral-700'
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-8 rounded-xl shadow-2xl dark:shadow-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black text-blue-600 dark:text-blue-300 uppercase tracking-[0.2em]">
              Patient Registration Form
            </h3>
            <button
              type="button"
              onClick={() => setFormData(fillRandomPatient(formData))}
              className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-950 transition-colors"
            >
              Fill Random
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                Full Name
              </label>
              <input
                required
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: formatNameInput(e.target.value) })
                }
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                CNIC (XXXXX-XXXXXXX-X)
              </label>
              <input
                placeholder="42101-1234567-1"
                value={formData.cnic}
                onChange={(e) =>
                  setFormData({ ...formData, cnic: formatCNICInput(e.target.value) })
                }
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                Mobile Number
              </label>
              <input
                required
                value={formData.mobile_number}
                onChange={(e) =>
                  setFormData({ ...formData, mobile_number: formatPhoneInput(e.target.value) })
                }
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                District (Karachi)
              </label>
              <select
                required
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
              >
                <option value="">Select District</option>
                <option value="South">South</option>
                <option value="East">East</option>
                <option value="West">West</option>
                <option value="Central">Central</option>
                <option value="Malir">Malir</option>
                <option value="Korangi">Korangi</option>
                <option value="Keamari">Keamari</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                Complete Address
              </label>
              <textarea
                value={formData.complete_address}
                onChange={(e) => setFormData({ ...formData, complete_address: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40 h-24"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                Service Type
              </label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
              >
                <option value="12h_day">12h Day</option>
                <option value="12h_night">12h Night</option>
                <option value="24h">24h Full</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                Monthly Package (PKR)
              </label>
              <input
                type="number"
                required
                value={formData.monthly_package_pkr}
                onChange={(e) => setFormData({ ...formData, monthly_package_pkr: e.target.value })}
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-emerald-600 dark:text-emerald-300 text-sm font-mono outline-none focus:border-emerald-500/40"
              />
            </div>
            <div className="space-y-2 text-right md:col-span-2 mt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl dark:shadow-none shadow-emerald-500/20 flex items-center gap-2 ml-auto"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Confirm Registration'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Patient Modal */}
      {editPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-neutral-900/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl dark:shadow-none w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-blue-600 dark:text-blue-300 uppercase tracking-[0.2em]">
                Edit Patient — {editPatient.full_name}
              </h3>
              <button
                onClick={() => setEditPatient(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 rounded-lg transition-colors text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Full Name
                </label>
                <input
                  required
                  value={editFormData.patient_name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, patient_name: e.target.value })
                  }
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  CNIC
                </label>
                <input
                  value={editFormData.cnic}
                  onChange={(e) => setEditFormData({ ...editFormData, cnic: e.target.value })}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm font-mono outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Mobile Number
                </label>
                <input
                  required
                  value={editFormData.mobile_number}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, mobile_number: e.target.value })
                  }
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm font-mono outline-none focus:border-emerald-500/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  District
                </label>
                <select
                  required
                  value={editFormData.district}
                  onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
                >
                  <option value="">Select District</option>
                  <option value="South">South</option>
                  <option value="East">East</option>
                  <option value="West">West</option>
                  <option value="Central">Central</option>
                  <option value="Malir">Malir</option>
                  <option value="Korangi">Korangi</option>
                  <option value="Keamari">Keamari</option>
                  <option value="Gulshan">Gulshan</option>
                  <option value="Clifton">Clifton</option>
                  <option value="DHA">DHA</option>
                  <option value="North Nazimabad">North Nazimabad</option>
                  <option value="Garden">Garden</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Service Type
                </label>
                <select
                  value={editFormData.service_type}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, service_type: e.target.value })
                  }
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
                >
                  <option value="24hr">24hr Full</option>
                  <option value="12hr">12hr</option>
                  <option value="8hr">8hr</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Monthly Package (PKR)
                </label>
                <input
                  type="number"
                  required
                  value={editFormData.monthly_package_pkr}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, monthly_package_pkr: e.target.value })
                  }
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-emerald-600 dark:text-emerald-300 text-sm font-mono outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, status: e.target.value as PatientStatus })
                  }
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40"
                >
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Complete Address
                </label>
                <textarea
                  value={editFormData.complete_address}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, complete_address: e.target.value })
                  }
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40 h-24"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setEditPatient(null)}
                className="px-6 py-3 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isSavingEdit}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
              >
                {isSavingEdit ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {(() => {
          const filteredPatients = patients.filter((p: any) => {
            if (statusFilter === 'All') return true
            if (statusFilter === 'Discontinued') return p.end_date != null
            if (statusFilter === 'Active') return p.status === 'Active' && !p.end_date
            return p.status === statusFilter
          })
          return filteredPatients.length === 0 ? (
            <div className="bg-white dark:bg-neutral-900 border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl p-12 text-center">
              <ClipboardList
                className="text-gray-500 dark:text-neutral-400 mx-auto mb-4"
                size={48}
              />
              <p className="text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs">
                No entries found in registry
              </p>
            </div>
          ) : (
            filteredPatients.map((patient: any) => (
              <div
                key={patient.id}
                id={`patient-card-${patient.id}`}
                className="bg-white dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 rounded-2xl p-6 shadow-2xl dark:shadow-none group hover:border-gray-200 dark:hover:border-neutral-700 dark:border-neutral-700 transition-all scroll-mt-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-gray-200 dark:border-neutral-700">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-gray-800 dark:text-neutral-100 uppercase tracking-tighter text-xl">
                          {patient.full_name}
                        </h3>
                        <button
                          onClick={() => openEditModal(patient)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 rounded-lg transition-colors text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100"
                          title="Edit patient"
                        >
                          <Pencil size={14} />
                        </button>
                        {!patient.end_date ? (
                          <button
                            onClick={() => {
                              setSelectedPatientForEndService(patient)
                              setEndServiceDate(new Date().toISOString().split('T')[0])
                              setEndServiceReason('')
                              setEndServiceNotes('')
                            }}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors text-gray-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                            title="End Service"
                          >
                            <UserX size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              if (!confirm('Reinstate this patient?')) return
                              try {
                                await patientService.updatePatient(patient.id, {
                                  status: 'Active',
                                  end_date: null,
                                  end_reason: null,
                                  end_notes: null,
                                })
                                loadPatients()
                              } catch (err) {
                                console.error('Error reinstating patient:', err)
                                alert('Failed to reinstate patient')
                              }
                            }}
                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-lg transition-colors text-emerald-600 dark:text-emerald-400"
                            title="Reinstate"
                          >
                            <Loader2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-bold flex items-center gap-1">
                          <MapPin size={10} className="text-blue-500" /> {patient.district}
                        </span>
                        {patient.cnic && (
                          <>
                            <span className="w-1 h-1 bg-gray-100 dark:bg-neutral-800 rounded-full"></span>
                            <span className="text-[10px] text-gray-500 dark:text-neutral-400 font-mono font-bold tracking-widest uppercase">
                              {patient.cnic}
                            </span>
                          </>
                        )}
                        <span className="w-1 h-1 bg-gray-100 dark:bg-neutral-800 rounded-full"></span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border',
                            patient.end_date
                              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-500/30 dark:border-red-800'
                              : patient.status === 'Active'
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                          )}
                        >
                          {patient.end_date ? 'DISCONTINUED' : patient.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-8 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-700">
                    <div className="text-center md:text-right">
                      <p className="text-[9px] uppercase font-black text-gray-400 dark:text-neutral-500 tracking-[0.2em] mb-1">
                        Monthly Package
                      </p>
                      <p className="text-lg font-mono font-bold text-emerald-600 dark:text-emerald-300 tracking-tighter">
                        PKR {(patient.monthly_package_pkr || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-gray-50 dark:bg-neutral-800/80 hidden md:block"></div>
                    <div className="text-center">
                      <p className="text-[9px] uppercase font-black text-gray-400 dark:text-neutral-500 tracking-[0.2em] mb-1">
                        Service
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-800 dark:text-neutral-100 uppercase">
                        <Clock size={12} className="text-blue-600 dark:text-blue-300" />{' '}
                        {patient.service_type?.replace('_', ' ') || '---'}
                      </div>
                    </div>
                  </div>
                </div>

                {patient.address && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-neutral-800/80 rounded-xl border border-gray-200 dark:border-neutral-700">
                    <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1 flex items-center gap-2">
                      <MapPin size={10} /> Residence Address
                    </p>
                    <p className="text-[11px] text-gray-600 dark:text-neutral-300 font-medium leading-relaxed">
                      {patient.address}
                    </p>
                  </div>
                )}

                {/* Intake Form Status */}
                <div className="mb-6 flex items-center justify-between bg-gray-50 dark:bg-neutral-800/80 rounded-xl p-4 border border-gray-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    {intakeStatus[patient.id] ? (
                      <>
                        <CheckCircle2
                          size={18}
                          className="text-emerald-600 dark:text-emerald-300"
                        />
                        <div>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                            Terms & Conditions Agreed
                          </p>
                          <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-bold">
                            Digital intake form completed
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <FileText size={16} className="text-gray-500 dark:text-neutral-400" />
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-neutral-100">
                            Intake Form Pending
                          </p>
                          <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-bold">
                            Send form to patient via WhatsApp
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const phone = patient.contact?.replace(/[^0-9]/g, '')
                      if (!phone) {
                        alert('Patient has no contact number on file.')
                        return
                      }
                      const msg = encodeURIComponent(
                        'HMSP Patient Intake Form\n\n' +
                          'Dear Patient, please fill this digital form to register for our home medical services. ' +
                          'The form includes our service agreement and terms & conditions.\n\n' +
                          'Link: https://nursingcareinfo.github.io/hmsp-dashboard/intake.html'
                      )
                      window.open(
                        `https://wa.me/${phone}?text=${msg}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shrink-0"
                  >
                    <MessageSquare size={14} />
                    Send to WhatsApp
                  </button>
                </div>

                {/* Assignments & Manual Salary Slots */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-neutral-800/80 rounded-xl p-4 border border-gray-200 dark:border-neutral-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 px-2 py-1 bg-blue-500/20 dark:bg-blue-950 text-blue-600 dark:text-blue-300 text-[7px] font-black uppercase tracking-widest border-b border-l border-blue-500/30 dark:border-blue-800 rounded-bl-md">
                      Day Shift (12h)
                    </div>
                    <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest mb-3">
                      Assigned Staff
                    </p>
                    {(() => {
                      const dayAssignment = (assignments[patient.id] || []).find(
                        (a: any) => a.shift_type === 'Morning'
                      )
                      const assignKey = `${patient.id}:day`
                      if (dayAssignment) {
                        const emp = dayAssignment.employee
                        const rate =
                          dayAssignment.decided_rate_pkr ||
                          Math.round((emp?.expected_salary_pkr || 0) / 30)
                        return (
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-500 shrink-0">
                                <User size={14} />
                              </div>
                              <p className="text-sm font-bold text-gray-800 dark:text-neutral-100 truncate">
                                {emp?.full_name || 'Staff Assigned'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1">
                                Rate/Shift
                              </p>
                              <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-300">
                                {formatPKR(rate)}
                              </p>
                            </div>
                          </div>
                        )
                      }
                      if (assigningSlot === assignKey) {
                        return (
                          <div className="space-y-3">
                            <p className="text-[9px] text-blue-600 dark:text-blue-300 uppercase font-bold tracking-widest">
                              Assign Day Staff
                            </p>
                            <select
                              value={assigningStaffId}
                              onChange={(e) => setAssigningStaffId(e.target.value)}
                              className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-blue-500/40"
                            >
                              <option value="">Select staff...</option>
                              {availableStaff.map((s: any) => (
                                <option key={s.id} value={s.id}>
                                  {s.full_name} — {s.district || 'N/A'}{' '}
                                  {s.category ? `(${s.category})` : ''}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                disabled={!assigningStaffId || isAssigning}
                                onClick={async () => {
                                  if (!assigningStaffId) return
                                  setIsAssigning(true)
                                  try {
                                    const emp = availableStaff.find(
                                      (s) => s.id === assigningStaffId
                                    )
                                    await shiftService.logShift({
                                      employee_id: assigningStaffId,
                                      patient_id: patient.id,
                                      shift_date: new Date().toISOString().split('T')[0],
                                      shift_type: 'Morning',
                                      decided_rate_pkr: Math.round(
                                        (emp?.expected_salary_pkr || 0) / 30
                                      ),
                                      attendance_status: 'Scheduled',
                                    })
                                    // Mark staff as unavailable globally
                                    await staffService.updateStaff(assigningStaffId, {
                                      is_available: false,
                                    })
                                    await loadAssignments([patient.id])
                                    // Refresh available staff list
                                    staffService
                                      .getAvailableStaff()
                                      .then(setAvailableStaff)
                                      .catch((err) => {
                                        console.error('Error refreshing available staff:', err)
                                      })
                                    setAssigningSlot(null)
                                    setAssigningStaffId('')
                                  } catch (err) {
                                    console.error('Error assigning staff:', err)
                                    alert('Failed to assign staff')
                                  } finally {
                                    setIsAssigning(false)
                                  }
                                }}
                                className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                              >
                                {isAssigning ? 'Assigning...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => {
                                  setAssigningSlot(null)
                                  setAssigningStaffId('')
                                }}
                                className="px-3 py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400/50 text-[10px] uppercase font-bold italic py-2">
                            <AlertCircle size={14} /> Slot Unassigned
                          </div>
                          <button
                            onClick={() => {
                              setAssigningSlot(assignKey)
                              setAssigningStaffId('')
                            }}
                            className="px-3 py-1.5 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300 rounded-lg border border-gray-200 dark:border-neutral-700 transition-all"
                          >
                            Assign Staff +
                          </button>
                        </div>
                      )
                    })()}
                  </div>

                  {patient.service_type === '24hr' && (
                    <div className="bg-gray-50 dark:bg-neutral-800/80 rounded-xl p-4 border border-gray-200 dark:border-neutral-700 relative overflow-hidden">
                      <div className="absolute top-0 right-0 px-2 py-1 bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[7px] font-black uppercase tracking-widest border-b border-l border-purple-500/30 rounded-bl-md">
                        Night Shift (12h)
                      </div>
                      <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest mb-3">
                        Assigned Staff
                      </p>
                      {(() => {
                        const nightAssignment = (assignments[patient.id] || []).find(
                          (a: any) => a.shift_type === 'Night'
                        )
                        const nightAssignKey = `${patient.id}:night`
                        if (nightAssignment) {
                          const emp = nightAssignment.employee
                          const rate =
                            nightAssignment.decided_rate_pkr ||
                            Math.round((emp?.expected_salary_pkr || 0) / 30)
                          return (
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/5 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                                  <User size={14} />
                                </div>
                                <p className="text-sm font-bold text-gray-800 dark:text-neutral-100 truncate">
                                  {emp?.full_name || 'Staff Assigned'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest mb-1">
                                  Rate/Shift
                                </p>
                                <p className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                                  {formatPKR(rate)}
                                </p>
                              </div>
                            </div>
                          )
                        }
                        if (assigningSlot === nightAssignKey) {
                          return (
                            <div className="space-y-3">
                              <p className="text-[9px] text-purple-600 dark:text-purple-400 uppercase font-bold tracking-widest">
                                Assign Night Staff
                              </p>
                              <select
                                value={assigningStaffId}
                                onChange={(e) => setAssigningStaffId(e.target.value)}
                                className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-purple-500/40"
                              >
                                <option value="">Select staff...</option>
                                {availableStaff.map((s: any) => (
                                  <option key={s.id} value={s.id}>
                                    {s.full_name} — {s.district || 'N/A'}{' '}
                                    {s.category ? `(${s.category})` : ''}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-2">
                                <button
                                  disabled={!assigningStaffId || isAssigning}
                                  onClick={async () => {
                                    if (!assigningStaffId) return
                                    setIsAssigning(true)
                                    try {
                                      const emp = availableStaff.find(
                                        (s) => s.id === assigningStaffId
                                      )
                                      await shiftService.logShift({
                                        employee_id: assigningStaffId,
                                        patient_id: patient.id,
                                        shift_date: new Date().toISOString().split('T')[0],
                                        shift_type: 'Night',
                                        decided_rate_pkr: Math.round(
                                          (emp?.expected_salary_pkr || 0) / 30
                                        ),
                                        attendance_status: 'Scheduled',
                                      })
                                      // Mark staff as unavailable globally
                                      await staffService.updateStaff(assigningStaffId, {
                                        is_available: false,
                                      })
                                      await loadAssignments([patient.id])
                                      // Refresh available staff list
                                      staffService
                                        .getAvailableStaff()
                                        .then(setAvailableStaff)
                                        .catch((err) => {
                                          console.error('Error refreshing available staff:', err)
                                        })
                                      setAssigningSlot(null)
                                      setAssigningStaffId('')
                                    } catch (err) {
                                      console.error('Error assigning staff:', err)
                                      alert('Failed to assign staff')
                                    } finally {
                                      setIsAssigning(false)
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                >
                                  {isAssigning ? 'Assigning...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => {
                                    setAssigningSlot(null)
                                    setAssigningStaffId('')
                                  }}
                                  className="px-3 py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )
                        }
                        return (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400/50 text-[10px] uppercase font-bold italic py-2">
                              <AlertCircle size={14} /> Pending Match
                            </div>
                            <button
                              onClick={() => {
                                setAssigningSlot(nightAssignKey)
                                setAssigningStaffId('')
                              }}
                              className="px-3 py-1.5 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 rounded-lg border border-gray-200 dark:border-neutral-700 transition-all"
                            >
                              Assign Staff +
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>

                {/* Invoices Section */}
                <div className="border-t border-gray-200 dark:border-neutral-700 pt-4 mt-4">
                  <button
                    onClick={() => {
                      const next = new Set(expandedPatients)
                      if (next.has(patient.id)) next.delete(patient.id)
                      else next.add(patient.id)
                      setExpandedPatients(next)
                    }}
                    className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500 hover:text-gray-800 dark:text-neutral-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedPatients.has(patient.id) ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      <Receipt size={14} />
                      Invoices ({(invoices[patient.id] || []).length})
                      {(() => {
                        const patientInvs = invoices[patient.id] || []
                        const unpaid = patientInvs.find((i) => i.status === 'Unpaid')
                        return unpaid ? (
                          <span className="text-amber-600 dark:text-amber-400 ml-2">
                            — PKR {(unpaid.amount ?? 0).toLocaleString()} • Unpaid
                          </span>
                        ) : null
                      })()}
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await patientInvoiceService.generateInvoice(
                            patient.id,
                            patient.monthly_package_pkr
                          )
                          const refreshed = await patientInvoiceService.getInvoicesForPatient(
                            patient.id
                          )
                          setInvoices((prev) => ({ ...prev, [patient.id]: refreshed }))
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Failed to generate invoice')
                        }
                      }}
                      className="text-[9px] px-3 py-1.5 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
                    >
                      + Generate Invoice
                    </button>
                  </button>

                  {expandedPatients.has(patient.id) && (
                    <div className="mt-3 space-y-1">
                      {(invoices[patient.id] || []).length === 0 ? (
                        <p className="text-[10px] text-gray-400 dark:text-neutral-500 italic py-2 text-center">
                          No invoices yet
                        </p>
                      ) : (
                        (invoices[patient.id] || []).map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 text-[11px]"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-gray-400 dark:text-neutral-500 font-mono">
                                {formatPeriod(inv.period_start, inv.period_end)}
                              </span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-300">
                                PKR {(inv.amount ?? 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              {inv.status === 'Paid' ? (
                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300">
                                  <CheckCircle2 size={12} /> Paid
                                </span>
                              ) : inv.status === 'Cancelled' ? (
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                                  Cancelled
                                </span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                                    <Circle size={12} className="fill-amber-400/20" /> Unpaid
                                  </span>
                                  <button
                                    onClick={async () => {
                                      if (
                                        !confirm(
                                          `Mark invoice for PKR ${(inv.amount ?? 0).toLocaleString()} as PAID?`
                                        )
                                      )
                                        return
                                      await patientInvoiceService.markAsPaid(inv.id)
                                      const refreshed =
                                        await patientInvoiceService.getInvoicesForPatient(
                                          patient.id
                                        )
                                      setInvoices((prev) => ({ ...prev, [patient.id]: refreshed }))
                                    }}
                                    className="text-[8px] px-2 py-1 bg-emerald-500/20 dark:bg-emerald-950 hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300 rounded-lg transition-colors font-black uppercase tracking-widest"
                                  >
                                    Mark Paid
                                  </button>
                                  <button
                                    onClick={() => {
                                      const phone = patient.contact?.replace(/[^0-9]/g, '')
                                      if (!phone) {
                                        alert('Patient has no contact number.')
                                        return
                                      }
                                      const invoiceUrl = `https://nursingcareinfo.github.io/hmsp-dashboard/invoice.html?id=${inv.id}`
                                      const msg = encodeURIComponent(
                                        `HMSP Digital Invoice — #${inv.id.slice(0, 8).toUpperCase()}\n\n` +
                                          `Dear ${patient.full_name}, your invoice for home medical services is ready.\n\n` +
                                          `Amount: PKR ${(inv.amount ?? 0).toLocaleString()}\n` +
                                          `Period: ${new Date(inv.period_start).toLocaleDateString()} to ${new Date(inv.period_end).toLocaleDateString()}\n\n` +
                                          `View & Download: ${invoiceUrl}\n\n` +
                                          `Please settle the payment and notify the agency.`
                                      )
                                      window.open(
                                        `https://wa.me/${phone}?text=${msg}`,
                                        '_blank',
                                        'noopener,noreferrer'
                                      )
                                    }}
                                    className="text-[8px] px-2 py-1 bg-blue-500/20 dark:bg-blue-950 hover:bg-blue-500/30 text-blue-600 dark:text-blue-300 rounded-lg transition-colors font-black uppercase tracking-widest flex items-center gap-1"
                                  >
                                    <MessageSquare size={10} /> WhatsApp
                                  </button>
                                  <button
                                    onClick={() => {
                                      window.open(
                                        `https://nursingcareinfo.github.io/hmsp-dashboard/invoice.html?id=${inv.id}`,
                                        '_blank'
                                      )
                                    }}
                                    className="text-[8px] px-2 py-1 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 rounded-lg transition-colors font-black uppercase tracking-widest"
                                  >
                                    View
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Equipment Rentals Section */}
                <div className="border-t border-gray-200 dark:border-neutral-700 pt-4 mt-4">
                  <button
                    onClick={() => {
                      const next = new Set(expandedEquipment)
                      if (next.has(patient.id)) next.delete(patient.id)
                      else next.add(patient.id)
                      setExpandedEquipment(next)
                    }}
                    className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500 hover:text-gray-800 dark:text-neutral-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedEquipment.has(patient.id) ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                      <Package size={14} />
                      Equipment Rentals ({(equipment[patient.id] || []).length})
                      {(() => {
                        const items = equipment[patient.id] || []
                        const rented = items.filter((i) => i.status === 'rented')
                        const total = rented.reduce((s, i) => s + i.rental_rate * i.quantity, 0)
                        return rented.length > 0 ? (
                          <span className="text-blue-600 dark:text-blue-300 ml-2">
                            — {rented.length} item{rented.length > 1 ? 's' : ''} rented • PKR{' '}
                            {total.toLocaleString()}/mo
                          </span>
                        ) : null
                      })()}
                    </div>
                  </button>

                  {expandedEquipment.has(patient.id) && (
                    <div className="mt-3 space-y-2">
                      {(equipment[patient.id] || []).length === 0 ? (
                        <p className="text-[10px] text-gray-400 dark:text-neutral-500 italic py-2 text-center">
                          No equipment rentals yet
                        </p>
                      ) : (
                        (equipment[patient.id] || []).map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center justify-between py-2 px-3 rounded-lg border text-[11px] ${
                              item.status === 'returned'
                                ? 'bg-gray-50 dark:bg-neutral-800/80 border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400'
                                : 'bg-gray-50 dark:bg-neutral-800/80 border-gray-200 dark:border-neutral-700 text-gray-800 dark:text-neutral-100'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-bold truncate">{item.item_name}</span>
                              <span className="text-gray-500 dark:text-neutral-400 shrink-0">
                                ×{item.quantity}
                              </span>
                              <span className="font-mono font-bold shrink-0">
                                PKR {(item.rental_rate * item.quantity).toLocaleString()}/
                                {item.rate_period === 'daily' ? 'day' : 'mo'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[8px] text-gray-500 dark:text-neutral-400 font-mono">
                                {item.rented_at}
                              </span>
                              {item.status === 'rented' ? (
                                <>
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    Rented
                                  </span>
                                  <button
                                    disabled={isReturningEquip === item.id}
                                    onClick={async () => {
                                      setIsReturningEquip(item.id!)
                                      try {
                                        await equipmentService.markReturned(item.id!)
                                        loadEquipment([patient.id])
                                      } catch (err) {
                                        console.error('Error returning equipment:', err)
                                        alert('Failed to mark as returned')
                                      } finally {
                                        setIsReturningEquip(null)
                                      }
                                    }}
                                    className="text-[8px] px-2 py-1 bg-amber-500/20 dark:bg-amber-950 hover:bg-amber-500/30 text-amber-600 dark:text-amber-400 rounded-lg transition-colors font-black uppercase tracking-widest"
                                  >
                                    {isReturningEquip === item.id ? '...' : 'Return'}
                                  </button>
                                </>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border border-gray-200 dark:border-neutral-700">
                                  Returned {item.returned_at}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}

                      {/* Add Equipment Form */}
                      {showEquipForm === patient.id ? (
                        <div className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 space-y-3">
                          <p className="text-[9px] text-blue-600 dark:text-blue-300 uppercase font-bold tracking-widest">
                            Add Equipment
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                                Item Name
                              </label>
                              <input
                                value={equipForm.item_name}
                                onChange={(e) =>
                                  setEquipForm({ ...equipForm, item_name: e.target.value })
                                }
                                placeholder="e.g. Hospital Bed"
                                className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                                Qty
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={equipForm.quantity}
                                onChange={(e) =>
                                  setEquipForm({
                                    ...equipForm,
                                    quantity: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                                Rental Rate (PKR)
                              </label>
                              <input
                                type="number"
                                value={equipForm.rental_rate}
                                onChange={(e) =>
                                  setEquipForm({ ...equipForm, rental_rate: e.target.value })
                                }
                                className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-blue-500/40"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                                Period
                              </label>
                              <select
                                value={equipForm.rate_period}
                                onChange={(e) =>
                                  setEquipForm({
                                    ...equipForm,
                                    rate_period: e.target.value as 'daily' | 'monthly',
                                  })
                                }
                                className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-blue-500/40"
                              >
                                <option value="monthly">Monthly</option>
                                <option value="daily">Daily</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                                Rented Date
                              </label>
                              <input
                                type="date"
                                value={equipForm.rented_at}
                                onChange={(e) =>
                                  setEquipForm({ ...equipForm, rented_at: e.target.value })
                                }
                                className="w-full bg-black/40 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-blue-500/40"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              disabled={
                                !equipForm.item_name || !equipForm.rental_rate || isAddingEquip
                              }
                              onClick={async () => {
                                if (!equipForm.item_name || !equipForm.rental_rate) return
                                setIsAddingEquip(true)
                                try {
                                  await equipmentService.addItem({
                                    patient_id: patient.id,
                                    item_name: equipForm.item_name,
                                    quantity: equipForm.quantity,
                                    rental_rate: parseFloat(equipForm.rental_rate) || 0,
                                    rate_period: equipForm.rate_period,
                                    rented_at: equipForm.rented_at,
                                    status: 'rented',
                                  })
                                  setEquipForm({
                                    item_name: '',
                                    quantity: 1,
                                    rental_rate: '',
                                    rate_period: 'monthly',
                                    rented_at: new Date().toISOString().split('T')[0],
                                  })
                                  loadEquipment([patient.id])
                                  setShowEquipForm(null)
                                } catch (err) {
                                  console.error('Error adding equipment:', err)
                                  alert('Failed to add equipment')
                                } finally {
                                  setIsAddingEquip(false)
                                }
                              }}
                              className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                            >
                              {isAddingEquip ? 'Adding...' : 'Add'}
                            </button>
                            <button
                              onClick={() => setShowEquipForm(null)}
                              className="px-3 py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-gray-800 dark:text-neutral-100 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowEquipForm(patient.id)}
                          className="w-full py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300 rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 transition-all"
                        >
                          + Add Equipment
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    title="Financial Ledger"
                    className="p-3 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-xl transition-colors border border-gray-200 dark:border-neutral-700 group-hover:border-gray-200 dark:hover:border-neutral-700 dark:border-neutral-700"
                  >
                    <CreditCard
                      size={18}
                      className="text-gray-500 dark:text-neutral-400 group-hover:text-gray-800 dark:text-neutral-100 transition-colors"
                    />
                  </button>
                  <button className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-[10px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-xl dark:shadow-none shadow-emerald-500/10">
                    Manage Case
                  </button>
                </div>
              </div>
            ))
          )
        })()}
      </div>

      {/* End Service Modal */}
      {selectedPatientForEndService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl dark:shadow-none overflow-hidden p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-red-600 dark:text-red-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <UserX size={20} /> End Service
              </h3>
              <button
                onClick={() => setSelectedPatientForEndService(null)}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-neutral-800/80 rounded-xl p-4 border border-gray-200 dark:border-neutral-700">
                <p className="text-sm font-bold text-gray-800 dark:text-neutral-100">
                  {selectedPatientForEndService.full_name}
                </p>
                <p className="text-[10px] font-mono text-gray-500 dark:text-neutral-400">
                  {selectedPatientForEndService.cnic}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Date of Discontinuation
                </label>
                <input
                  type="date"
                  value={endServiceDate}
                  onChange={(e) => setEndServiceDate(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-red-500/40"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Reason
                </label>
                <select
                  value={endServiceReason}
                  onChange={(e) => setEndServiceReason(e.target.value)}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-red-500/40"
                >
                  <option value="">Select a reason...</option>
                  <option value="Cured">Cured</option>
                  <option value="Deceased">Deceased</option>
                  <option value="Transferred">Transferred</option>
                  <option value="Family Decision">Family Decision</option>
                  <option value="Violation">Violation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-widest">
                  Notes (optional)
                </label>
                <textarea
                  value={endServiceNotes}
                  onChange={(e) => setEndServiceNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-red-500/40"
                />
              </div>

              <div className="bg-red-50 dark:bg-red-950 border border-red-500/20 rounded-xl p-4">
                <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest leading-relaxed">
                  This will mark the patient as discontinued, unassign all staff shifts, and cancel
                  unpaid invoices.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedPatientForEndService(null)}
                  className="flex-1 py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:text-neutral-100 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!endServiceDate || !endServiceReason) {
                      alert('Please fill in date and reason')
                      return
                    }
                    setIsEndingService(true)
                    try {
                      await patientService.updatePatient(selectedPatientForEndService.id, {
                        status: 'Cancelled',
                        end_date: endServiceDate,
                        end_reason: endServiceReason,
                        end_notes: endServiceNotes || null,
                      })
                      await shiftService.unassignPatientShifts(selectedPatientForEndService.id)
                      await patientInvoiceService.cancelUnpaidInvoices(
                        selectedPatientForEndService.id
                      )
                      setSelectedPatientForEndService(null)
                      loadPatients()
                    } catch (err) {
                      console.error('Error ending service:', err)
                      alert('Failed to end service')
                    } finally {
                      setIsEndingService(false)
                    }
                  }}
                  disabled={!endServiceDate || !endServiceReason || isEndingService}
                  className="flex-1 py-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                >
                  {isEndingService ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <>End Service</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[s.getMonth()]} ${s.getDate()}-${e.getDate()}, ${s.getFullYear()}`
}
