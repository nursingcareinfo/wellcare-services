/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'
import {
  ClipboardList,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  MapPin,
  User,
  Hash,
  Calendar,
  DollarSign,
  FileText,
  Briefcase,
  CreditCard,
  CheckCircle2,
  Clock,
  MessageSquare,
  Loader2,
  UserCheck,
} from 'lucide-react'
import { cn, formatPKR } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { staffService } from '../services/staffService'

interface StaffIntake {
  id: string
  created_at: string
  full_name: string
  father_husband_name: string | null
  gender: string | null
  cnic_number: string | null
  date_of_birth: string | null
  phone_primary: string
  district: string | null
  complete_address: string | null
  position_applied: string | null
  experience_years: number | null
  shift_preference: string | null
  expected_salary_pkr: number | null
  bank_name: string | null
  account_no: string | null
  account_title: string | null
  iban: string | null
  status: string
  staff_notes: string | null
  terms_accepted: boolean
  document_urls: any
}

const STATUS_FLOW = ['pending', 'reviewed', 'verified', 'approved', 'rejected'] as const

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  reviewed:
    'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  verified: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  approved:
    'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  rejected: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-500/20',
}

function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-PK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border',
        STATUS_STYLES[status] || STATUS_STYLES.pending
      )}
    >
      {status}
    </span>
  )
}

export default function StaffIntakesView() {
  const [intakes, setIntakes] = useState<StaffIntake[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    loadIntakes()
  }, [])

  async function loadIntakes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('staff_intakes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setIntakes(data || [])
    } catch (err) {
      console.error('Error loading intakes:', err)
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    setUpdatingId(id)
    try {
      const { error } = await supabase
        .from('staff_intakes')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      setIntakes((prev) => prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i)))
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  async function approveAndMerge(intake: StaffIntake) {
    if (!confirm(`Approve and add ${intake.full_name} to main staff ledger?`)) return

    setUpdatingId(intake.id)
    try {
      // Create staff record
      await staffService.createStaff({
        full_name: intake.full_name,
        father_husband_name: intake.father_husband_name || undefined,
        gender: intake.gender || undefined,
        cnic_number: intake.cnic_number || undefined,
        dob: intake.date_of_birth || undefined,
        phone_primary: intake.phone_primary,
        whatsapp_number: intake.phone_primary,
        district: intake.district || 'Karachi South',
        complete_address: intake.complete_address || undefined,
        position_applied: intake.position_applied || 'Nurse',
        experience_years: intake.experience_years || 0,
        shift_preference: intake.shift_preference || undefined,
        expected_salary_pkr: intake.expected_salary_pkr || 0,
        bank_info: {
          bank_name: intake.bank_name,
          account_no: intake.account_no,
          account_title: intake.account_title,
          iban: intake.iban,
        },
        is_active: true,
        is_available: true,
        is_verified: true,
        is_acknowledgment_signed: true,
        data_confidence: 'High',
      })

      // Update intake status
      await updateStatus(intake.id, 'approved')
      alert(`${intake.full_name} has been added to the main staff ledger.`)
    } catch (err: any) {
      console.error('Error merging staff:', err)
      alert(`Failed to merge: ${err.message}`)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = intakes.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      i.full_name.toLowerCase().includes(q) ||
      i.phone_primary.includes(q) ||
      (i.cnic_number && i.cnic_number.includes(q)) ||
      (i.position_applied && i.position_applied.toLowerCase().includes(q))
    )
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="text-emerald-500 animate-spin" size={40} />
        <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black">
          Loading Staff Applications...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-6 rounded-xl">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-neutral-100 uppercase tracking-tighter flex items-center gap-3">
            <UserCheck size={22} className="text-emerald-600 dark:text-emerald-300" />
            Staff Registration Queue
          </h2>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black mt-1">
            Review &amp; Verify Digital Registrations
          </p>
        </div>
        <button
          onClick={loadIntakes}
          className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg transition-colors text-gray-400 dark:text-neutral-500"
        >
          Refresh List
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl">
          <Clock size={40} className="mx-auto mb-4 text-gray-400 dark:text-neutral-500" />
          <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest">
            No registration requests found
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((intake) => {
            const isExpanded = expandedId === intake.id
            const currentIdx = STATUS_FLOW.indexOf(intake.status as (typeof STATUS_FLOW)[number])
            const nextStatus =
              currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

            return (
              <div
                key={intake.id}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden transition-all hover:border-gray-200 dark:hover:border-neutral-700 dark:border-neutral-700"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : intake.id)}
                  className="w-full text-left p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-gray-800 dark:text-neutral-100 truncate">
                        {intake.full_name}
                      </h3>
                      <StatusBadge status={intake.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1">
                        <Phone size={10} /> {intake.phone_primary}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase size={10} /> {intake.position_applied || 'Nurse'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(intake.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {intake.status !== 'approved' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          approveAndMerge(intake)
                        }}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-500 text-slate-950 rounded-lg transition-all flex items-center gap-1.5"
                      >
                        {updatingId === intake.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <UserCheck size={10} />
                        )}
                        Approve & Merge
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-200 dark:border-neutral-700 pt-4 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Column 1: Personal */}
                      <div className="space-y-3">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                          <User size={12} /> Personal Details
                        </h4>
                        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 space-y-2 text-xs">
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">
                              Father/Husband:
                            </span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.father_husband_name || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">CNIC:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100 font-mono">
                              {intake.cnic_number || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">DOB:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {formatDate(intake.date_of_birth || '')}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Gender:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.gender || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Address:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100 leading-relaxed">
                              {intake.complete_address || '—'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Column 2: Professional */}
                      <div className="space-y-3">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300 flex items-center gap-2">
                          <Briefcase size={12} /> Professional
                        </h4>
                        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 space-y-2 text-xs">
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Position:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100 font-bold">
                              {intake.position_applied || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Experience:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.experience_years} Years
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Shift Pref:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.shift_preference || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Expected:</span>{' '}
                            <span className="text-emerald-600 dark:text-emerald-300 font-mono font-bold">
                              {formatPKR(intake.expected_salary_pkr || 0)}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Column 3: Banking */}
                      <div className="space-y-3">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 flex items-center gap-2">
                          <CreditCard size={12} /> Bank Details
                        </h4>
                        <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 space-y-2 text-xs">
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Bank:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.bank_name || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Account #:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100 font-mono">
                              {intake.account_no || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Title:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.account_title || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">IBAN:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100 font-mono break-all">
                              {intake.iban || '—'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Management */}
                    <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-neutral-700">
                      {STATUS_FLOW.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(intake.id, s)}
                          className={cn(
                            'text-[8px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all',
                            intake.status === s
                              ? STATUS_STYLES[s]
                              : 'border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100 hover:bg-gray-50 dark:bg-neutral-800/80'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
