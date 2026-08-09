/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  ArrowUpRight,
  Loader2,
  Calendar,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPKR, cn } from '../lib/utils'
import { motion } from 'motion/react'
import { attendanceService } from '../services/attendanceService'

export default function FinanceView() {
  const [margins, setMargins] = useState<any[]>([])
  const [accruals, setAccruals] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadFinanceData() {
      setLoading(true)
      try {
        const now = new Date()
        const [marginsRes, accrualsRes, attendanceRes] = await Promise.all([
          supabase.from('real_time_margin_view').select('*'),
          supabase.from('staff_accrual_view').select('*'),
          attendanceService.getMonthAttendance(now.getFullYear(), now.getMonth()),
        ])

        if (marginsRes.data) setMargins(marginsRes.data)
        if (accrualsRes.data) setAccruals(accrualsRes.data)
        if (attendanceRes) setAttendance(attendanceRes)
      } catch (error) {
        console.error('Error fetching finance data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadFinanceData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="text-emerald-500 animate-spin" size={40} />
        <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black">
          Calculating Financial Ledger...
        </p>
      </div>
    )
  }

  const totalDailyMargin = margins.reduce((acc, m) => acc + Number(m.daily_margin), 0)
  const activeCases = margins.length

  const totalPresent = attendance.filter((a) => a.status === 'Present').length
  const totalAbsent = attendance.filter((a) => a.status === 'Absent').length
  const totalPayroll = attendance.reduce((acc, a) => {
    if (a.status === 'Present') return acc + 1
    if (a.status === 'Half-Day') return acc + 0.5
    return acc
  }, 0)

  return (
    <div className="space-y-8 pb-12">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl p-6 shadow-2xl dark:shadow-none overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 dark:bg-emerald-950 rounded-full blur-3xl group-hover:bg-emerald-500/20 dark:bg-emerald-950 transition-all"></div>
          <div className="flex items-center gap-3 text-[10px] font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-widest mb-4">
            <TrendingUp size={14} /> Estimated Daily Margin
          </div>
          <p className="text-3xl font-mono font-bold text-gray-800 dark:text-neutral-100 tracking-tighter">
            {formatPKR(totalDailyMargin).replace('Rs. ', '')}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest mt-2">
            Sum of active packages - employee rates
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl p-6 shadow-2xl dark:shadow-none relative group">
          <div className="flex items-center gap-3 text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest mb-4">
            <Users size={14} /> Active Revenue Units
          </div>
          <p className="text-3xl font-mono font-bold text-gray-800 dark:text-neutral-100 tracking-tighter">
            {activeCases}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest mt-2">
            Patients currently in "Active" status
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl p-6 shadow-2xl dark:shadow-none relative group">
          <div className="flex items-center gap-3 text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-4">
            <Calendar size={14} /> Avg. Package Rate
          </div>
          <p className="text-3xl font-mono font-bold text-gray-800 dark:text-neutral-100 tracking-tighter">
            {formatPKR(
              margins.reduce((acc, m) => acc + Number(m.monthly_package_pkr), 0) /
                (activeCases || 1)
            ).replace('Rs. ', '')}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest mt-2">
            Mean monthly value per patient
          </p>
        </div>
      </div>

      {/* Attendance Summary */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-neutral-500 mb-4">
          Attendance Summary
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-300">
              {totalPresent}
            </div>
            <div className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase">
              Total Present Days
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
              {totalAbsent}
            </div>
            <div className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase">
              Total Absent Days
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-300">
              {totalPayroll.toFixed(1)}
            </div>
            <div className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase">
              Est. Payroll Days
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Real-time Margin Ledger */}
        <div className="bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-2xl p-6">
          <h3 className="text-xs font-black text-gray-800 dark:text-neutral-100 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Real-Time Margin Ledger (Per Residence)
          </h3>
          <div className="space-y-4">
            {margins.map((m) => (
              <div
                key={m.patient_id}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-4 rounded-xl flex justify-between items-center group hover:border-emerald-500/30 dark:border-emerald-800 transition-all"
              >
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-neutral-100 uppercase tracking-tight">
                    {m.patient_name}
                  </p>
                  <div className="flex items-center gap-2 text-[9px] text-gray-500 dark:text-neutral-400 font-black uppercase tracking-widest mt-1">
                    <span className="text-blue-600 dark:text-blue-300">
                      {formatPKR(m.daily_revenue)}/day
                    </span>
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      -{formatPKR(m.daily_cost)} cost
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      'text-lg font-mono font-bold tracking-tighter',
                      m.daily_margin > 0
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {m.daily_margin > 0 ? '+' : ''}
                    {Math.round(m.daily_margin).toLocaleString()}
                  </p>
                  <p className="text-[8px] text-gray-500 dark:text-neutral-400 uppercase font-black tracking-[0.2em]">
                    Daily Net
                  </p>
                </div>
              </div>
            ))}
            {margins.length === 0 && (
              <div className="py-12 text-center opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest italic">
                  No active revenue streams detected.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Staff Accrual Ledger */}
        <div className="bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-2xl p-6">
          <h3 className="text-xs font-black text-gray-800 dark:text-neutral-100 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Staff Payout Accruals (Completed Shifts)
          </h3>
          <div className="space-y-4">
            {accruals.map((a) => (
              <div
                key={a.employee_id}
                className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-4 rounded-xl flex justify-between items-center group hover:border-blue-500/30 dark:border-blue-800 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-300 border border-gray-200 dark:border-neutral-700">
                    {a.full_name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-neutral-100 uppercase tracking-tight">
                      {a.full_name}
                    </p>
                    <p className="text-[9px] text-gray-500 dark:text-neutral-400 font-black uppercase tracking-widest mt-1">
                      {a.emp_no} • {a.total_shifts_completed} Completed Shifts
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-mono font-bold text-gray-800 dark:text-neutral-100 tracking-tighter">
                    {Number(a.total_earnings_accrued).toLocaleString()}
                  </p>
                  <div className="flex flex-col items-end">
                    <p className="text-[8px] text-blue-600 dark:text-blue-300 uppercase font-black tracking-[0.2em]">
                      Net Accrued PKR
                    </p>
                    {Number(a.total_penalties) > 0 && (
                      <p className="text-[8px] text-red-600 dark:text-red-400 font-bold uppercase tracking-widest mt-1">
                        -{Number(a.total_penalties).toLocaleString()} Penalty
                      </p>
                    )}
                    {Number(a.total_advances) > 0 && (
                      <p className="text-[8px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest mt-1">
                        -{Number(a.total_advances).toLocaleString()} Advance
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {accruals.length === 0 && (
              <div className="py-12 text-center opacity-30">
                <p className="text-[10px] font-black uppercase tracking-widest italic">
                  No completed shifts recorded for current payroll.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
