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
  Package,
  CheckCircle2,
  Clock,
  MessageSquare,
  Loader2,
  Share2,
} from 'lucide-react'
import { cn, formatPKR } from '../lib/utils'
import { supabase } from '../lib/supabase'
import ShareIntakeModal from './ShareIntakeModal'

interface PatientIntake {
  id: string
  created_at: string
  full_name: string
  guardian_name: string
  gender: string
  cnic: string
  date_of_birth: string | null
  mobile: string
  district: string | null
  address: string | null
  service_type: string
  billing_rate: number
  start_date: string
  signatory_name: string
  signatory_cnic: string
  terms_accepted: boolean
  equipment: any
  status: string
  staff_notes: string | null
}

const STATUS_FLOW = ['pending', 'reviewed', 'contacted', 'assigned', 'completed'] as const

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  reviewed:
    'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  contacted: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  assigned:
    'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  completed:
    'bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 border-gray-200 dark:border-neutral-700',
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

export default function PatientIntakesView() {
  const [intakes, setIntakes] = useState<PatientIntake[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [showShare, setShowShare] = useState(false)

  useEffect(() => {
    loadIntakes()
  }, [])

  async function loadIntakes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('patient_intakes')
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
        .from('patient_intakes')
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

  async function saveNotes(id: string, notes: string) {
    try {
      const { error } = await supabase
        .from('patient_intakes')
        .update({ staff_notes: notes })
        .eq('id', id)

      if (error) throw error
      setIntakes((prev) => prev.map((i) => (i.id === id ? { ...i, staff_notes: notes } : i)))
    } catch (err) {
      console.error('Error saving notes:', err)
    }
  }

  const filtered = intakes.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      i.full_name.toLowerCase().includes(q) ||
      i.mobile.includes(q) ||
      i.cnic.includes(q) ||
      i.service_type.toLowerCase().includes(q)
    )
  })

  const counts = {
    total: intakes.length,
    pending: intakes.filter((i) => i.status === 'pending').length,
    reviewed: intakes.filter((i) => i.status === 'reviewed').length,
    contacted: intakes.filter((i) => i.status === 'contacted').length,
    assigned: intakes.filter((i) => i.status === 'assigned').length,
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="text-emerald-500 animate-spin" size={40} />
        <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black">
          Loading Intakes...
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
            <ClipboardList size={22} className="text-emerald-600 dark:text-emerald-300" />
            Patient Intake Queue
          </h2>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black mt-1">
            Review &amp; Manage Incoming Referrals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShare(true)}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg transition-colors text-gray-400 dark:text-neutral-500 flex items-center gap-1.5"
          >
            <Share2 size={12} />
            Share Link
          </button>
          <button
            onClick={loadIntakes}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg transition-colors text-gray-400 dark:text-neutral-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          {
            label: 'Total',
            count: counts.total,
            color: 'text-gray-800 dark:text-neutral-100',
            active: statusFilter === 'all',
          },
          {
            label: 'Pending',
            count: counts.pending,
            color: 'text-yellow-400',
            active: statusFilter === 'pending',
          },
          {
            label: 'Reviewed',
            count: counts.reviewed,
            color: 'text-blue-600 dark:text-blue-300',
            active: statusFilter === 'reviewed',
          },
          {
            label: 'Contacted',
            count: counts.contacted,
            color: 'text-purple-600 dark:text-purple-400',
            active: statusFilter === 'contacted',
          },
          {
            label: 'Assigned',
            count: counts.assigned,
            color: 'text-emerald-600 dark:text-emerald-300',
            active: statusFilter === 'assigned',
          },
        ].map((s) => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(s.active ? 'all' : s.label.toLowerCase())}
            className={cn(
              'bg-white dark:bg-neutral-900 border rounded-xl p-4 text-left transition-all',
              s.active
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50'
                : 'border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600 dark:border-neutral-600'
            )}
          >
            <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black">
              {s.label}
            </p>
            <p className={cn('text-xl font-black mt-1', s.color)}>{s.count}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-neutral-400"
        />
        <input
          type="text"
          placeholder="Search by name, mobile, CNIC, or service..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-800 dark:text-neutral-100 outline-none focus:border-emerald-500/30 dark:border-emerald-800 transition-colors placeholder:text-gray-400 dark:placeholder:text-neutral-600 dark:text-neutral-500"
        />
      </div>

      {/* Intake List */}
      {filtered.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl">
          <ClipboardList size={40} className="mx-auto mb-4 text-gray-400 dark:text-neutral-500" />
          <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-widest">
            {intakes.length === 0 ? 'No intake submissions yet' : 'No intakes match your filter'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-neutral-500 mt-2">
            {intakes.length === 0
              ? 'Patient intake forms will appear here once submitted via the public form.'
              : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((intake) => {
            const isExpanded = expandedId === intake.id
            const equipment =
              typeof intake.equipment === 'string'
                ? JSON.parse(intake.equipment || '[]')
                : intake.equipment || []
            const currentIdx = STATUS_FLOW.indexOf(intake.status as (typeof STATUS_FLOW)[number])
            const nextStatus =
              currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null

            return (
              <div
                key={intake.id}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden transition-all hover:border-gray-200 dark:hover:border-neutral-700 dark:border-neutral-700"
              >
                {/* Summary Row */}
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
                        <Phone size={10} /> {intake.mobile}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={10} /> {intake.service_type}
                      </span>
                      {intake.district && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {intake.district}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(intake.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-gray-500 dark:text-neutral-400">
                    {nextStatus && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(intake.id, nextStatus)
                        }}
                        className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-500/20 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        {updatingId === intake.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={10} />
                        )}
                        Mark {nextStatus}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-200 dark:border-neutral-700 pt-4 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Patient Info */}
                      <div className="space-y-2">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-300 flex items-center gap-1.5">
                          <User size={10} /> Patient Details
                        </h4>
                        <div className="bg-gray-50 dark:bg-neutral-800/80 rounded-lg p-3 space-y-1.5 text-xs">
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Guardian:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.guardian_name}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">CNIC:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100 font-mono">
                              {intake.cnic}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Gender:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.gender}
                            </span>
                          </p>
                          {intake.date_of_birth && (
                            <p>
                              <span className="text-gray-500 dark:text-neutral-400">DOB:</span>{' '}
                              <span className="text-gray-800 dark:text-neutral-100">
                                {formatDate(intake.date_of_birth)}
                              </span>
                            </p>
                          )}
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Address:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.address || '—'}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Service Info */}
                      <div className="space-y-2">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300 flex items-center gap-1.5">
                          <FileText size={10} /> Service Details
                        </h4>
                        <div className="bg-gray-50 dark:bg-neutral-800/80 rounded-lg p-3 space-y-1.5 text-xs">
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Service:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.service_type}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Rate:</span>{' '}
                            <span className="text-emerald-600 dark:text-emerald-300 font-mono font-bold">
                              {formatPKR(intake.billing_rate)}/day
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Start:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {formatDate(intake.start_date)}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Submitted:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {formatDateTime(intake.created_at)}
                            </span>
                          </p>
                          <p>
                            <span className="text-gray-500 dark:text-neutral-400">Signed by:</span>{' '}
                            <span className="text-gray-800 dark:text-neutral-100">
                              {intake.signatory_name}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Equipment */}
                      <div className="space-y-2">
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                          <Package size={10} /> Equipment Rental
                        </h4>
                        <div className="bg-gray-50 dark:bg-neutral-800/80 rounded-lg p-3 space-y-1.5 text-xs">
                          {equipment.length === 0 ? (
                            <p className="text-gray-500 dark:text-neutral-400 italic">
                              No equipment requested
                            </p>
                          ) : (
                            equipment.map((eq: any, i: number) => (
                              <div
                                key={i}
                                className="border-b border-gray-200 dark:border-neutral-700 pb-1.5 last:border-0 last:pb-0"
                              >
                                <p className="text-gray-800 dark:text-neutral-100 font-bold">
                                  {eq.name}
                                </p>
                                <p className="text-gray-500 dark:text-neutral-400 text-[10px]">
                                  Qty: {eq.quantity}
                                  {eq.daily_fee > 0 && ` • ${formatPKR(eq.daily_fee)}/day`}
                                  {eq.start_date && ` • ${formatDate(eq.start_date)}`}
                                  {eq.end_date && ` → ${formatDate(eq.end_date)}`}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes & Actions */}
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      <div className="flex-1 w-full">
                        <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 flex items-center gap-1.5 mb-1.5">
                          <MessageSquare size={10} /> Staff Notes
                        </label>
                        <textarea
                          defaultValue={intake.staff_notes || ''}
                          rows={2}
                          placeholder="Add notes about this intake..."
                          onBlur={(e) => saveNotes(intake.id, e.target.value)}
                          className="w-full bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-lg p-3 text-xs text-gray-800 dark:text-neutral-100 outline-none focus:border-emerald-500/30 dark:border-emerald-800 transition-colors placeholder:text-gray-400 dark:placeholder:text-neutral-600 dark:text-neutral-500 resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        {STATUS_FLOW.map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(intake.id, s)}
                            disabled={s === intake.status}
                            className={cn(
                              'text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all',
                              s === intake.status
                                ? 'bg-emerald-500/20 dark:bg-emerald-950 border-emerald-500/30 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300'
                                : 'border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600 dark:border-neutral-600 hover:text-gray-800 dark:text-neutral-100'
                            )}
                          >
                            {updatingId === intake.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              s
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <ShareIntakeModal open={showShare} onClose={() => setShowShare(false)} />
    </div>
  )
}
