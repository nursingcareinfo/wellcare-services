import React, { useState, useEffect } from 'react'
import { X, Banknote, Briefcase, Receipt, Loader2 } from 'lucide-react'
import { advanceService, type SalaryAdvance } from '../services/advanceService'
import { shiftService, type ManualShift } from '../services/shiftService'
import { payrollService, type PayrollRecord } from '../services/payrollService'
import { formatPKR } from '../lib/utils'

interface StaffLedgerModalProps {
  staff: any
  onClose: () => void
}

type TimelineEvent = {
  id: string
  date: string
  type: 'advance' | 'shift' | 'payroll'
  description: string
  amount: number
  status: string
}

export default function StaffLedgerModal({ staff, onClose }: StaffLedgerModalProps) {
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const [shifts, setShifts] = useState<ManualShift[]>([])
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAll() {
      try {
        const [adv, sh, pr] = await Promise.all([
          advanceService.getAdvancesByEmployee(staff.id),
          shiftService.getShiftsByEmployee(staff.id),
          payrollService.getByEmployee(staff.id),
        ])
        setAdvances(adv || [])
        setShifts(sh || [])
        setPayrolls(pr || [])
      } catch (err: any) {
        console.error('Error loading ledger data:', err)
        setError(err.message || 'Failed to load financial data')
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [staff.id])

  const totalEarnings = shifts
    .filter((s) => s.attendance_status === 'Completed')
    .reduce((sum, s) => sum + (s.decided_rate_pkr || 0), 0)

  const totalAdvances = advances
    .filter((a) => a.status !== 'Settled')
    .reduce((sum, a) => sum + (a.amount_pkr || 0), 0)

  const netBalance = totalEarnings - totalAdvances

  const timeline: TimelineEvent[] = [
    ...advances.map((a) => ({
      id: a.id,
      date: a.disbursement_date || a.created_at,
      type: 'advance' as const,
      description: 'Advance - ' + (a.payment_method || 'Cash'),
      amount: a.amount_pkr,
      status: a.status,
    })),
    ...shifts.map((s) => ({
      id: s.id,
      date: s.shift_date,
      type: 'shift' as const,
      description: (s.shift_type === 'Night' ? 'Night' : 'Day') + ' Shift',
      amount: s.decided_rate_pkr,
      status: s.attendance_status,
    })),
    ...payrolls.map((p) => ({
      id: p.id,
      date: p.period_end || p.created_at,
      type: 'payroll' as const,
      description: 'Payout - ' + (p.period_start?.slice(0, 10) || '...'),
      amount: p.net_salary,
      status: p.status,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const statusColor = (status: string) => {
    switch (status) {
      case 'Completed':
      case 'Paid':
      case 'Settled':
        return 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
      case 'Pending':
      case 'Scheduled':
        return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
      case 'Abandoned':
      case 'Cancelled':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20'
      default:
        return 'text-gray-400 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
    }
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'advance':
        return <Banknote size={14} className="text-amber-600 dark:text-amber-400" />
      case 'shift':
        return <Briefcase size={14} className="text-blue-600 dark:text-blue-300" />
      case 'payroll':
        return <Receipt size={14} className="text-emerald-600 dark:text-emerald-300" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="flex flex-col items-center gap-4 text-gray-400 dark:text-neutral-500">
          <Loader2 className="animate-spin text-emerald-500" size={32} />
          <p className="text-[10px] uppercase tracking-widest font-bold">Loading Ledger...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400 font-bold text-sm mb-2">
            Failed to load ledger
          </p>
          <p className="text-gray-400 dark:text-neutral-500 text-xs mb-4">{error}</p>
          <button onClick={onClose} className="btn-primary px-6 py-2 text-xs">
            Close
          </button>
        </div>
      </div>
    )
  }

  const hasData = timeline.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl dark:shadow-none overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 p-6 flex items-start gap-4 z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center text-lg font-bold text-emerald-600 dark:text-emerald-300 shrink-0">
            {(staff.full_name || '?')[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-800 dark:text-neutral-100 truncate">
              {staff.full_name}
            </h2>
            <p className="text-[10px] font-mono text-emerald-500/80">
              {staff.emp_no} &bull; {staff.position_applied}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 p-6 pb-0">
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 text-center">
            <p className="text-[9px] text-blue-600 dark:text-blue-300 uppercase tracking-widest font-bold mb-1">
              Earnings
            </p>
            <p className="text-lg font-black text-blue-600 dark:text-blue-300 font-mono">
              {formatPKR(totalEarnings)}
            </p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-center">
            <p className="text-[9px] text-amber-600 dark:text-amber-400 uppercase tracking-widest font-bold mb-1">
              Advances
            </p>
            <p className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
              {formatPKR(totalAdvances)}
            </p>
          </div>
          <div
            className={
              'rounded-xl p-4 text-center border ' +
              (netBalance >= 0
                ? 'bg-emerald-500/5 border-emerald-500/10'
                : 'bg-rose-500/5 border-rose-500/10')
            }
          >
            <p className="text-[9px] uppercase tracking-widest font-bold mb-1 text-gray-400 dark:text-neutral-500">
              Net Due
            </p>
            <p
              className={
                'text-lg font-black font-mono ' +
                (netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-400')
              }
            >
              {formatPKR(netBalance)}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="p-6">
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-bold mb-4">
            Activity Timeline
          </p>

          {!hasData ? (
            <div className="bg-gray-100 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl p-8 text-center">
              <p className="text-gray-500 dark:text-neutral-400 text-sm">
                No financial history recorded for this staff member.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {timeline.map((event, i) => {
                const prevDate = i > 0 ? timeline[i - 1].date : null
                const showDateHeader =
                  !prevDate ||
                  new Date(event.date).toLocaleDateString() !==
                    new Date(prevDate).toLocaleDateString()

                return (
                  <React.Fragment key={event.id + '-' + i}>
                    {showDateHeader && (
                      <p className="text-[9px] text-gray-400 dark:text-neutral-500 uppercase tracking-widest font-bold pt-4 pb-1">
                        {new Date(event.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                    <div className="flex items-center gap-3 bg-white dark:bg-neutral-900/[0.02] hover:bg-white dark:bg-neutral-900/[0.05] rounded-xl px-4 py-3 transition-colors border border-gray-200 dark:border-neutral-700">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                        {typeIcon(event.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-neutral-100 truncate">
                          {event.description}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold font-mono text-gray-800 dark:text-neutral-100">
                          {formatPKR(event.amount)}
                        </p>
                      </div>
                      <span
                        className={
                          'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ' +
                          statusColor(event.status)
                        }
                      >
                        {event.status}
                      </span>
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="p-6 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-800 dark:text-neutral-100 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
