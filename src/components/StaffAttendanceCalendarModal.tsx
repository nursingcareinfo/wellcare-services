/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, X, Calendar, DollarSign, Minus, Equal } from 'lucide-react'
import { attendanceService, type AttendanceRecord } from '../services/attendanceService'
import { advanceService } from '../services/advanceService'
import type { SalaryAdvance } from '../services/advanceService'
import { cn, formatPKR } from '../lib/utils'

function getPeriodRange(year: number, month: number, period: 1 | 2) {
  if (period === 1) return { start: 1, end: 15 }
  const lastDay = new Date(year, month + 1, 0).getDate()
  return { start: 16, end: lastDay }
}

function getPaidDaysCount(
  attendance: any[],
  staffId: string,
  range: { start: number; end: number }
): number {
  return attendance.filter((a) => {
    const day = new Date(a.attendance_date).getDate()
    return (
      a.employee_id === staffId &&
      day >= range.start &&
      day <= range.end &&
      (a.status === 'Day' || a.status === 'Night' || a.status === 'Present')
    )
  }).length
}

function formatRate(rate: number): string {
  if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k`
  return String(rate)
}

function getPeriodLabel(year: number, month: number, period: 1 | 2): string {
  const m = new Date(year, month).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  })
  const range = getPeriodRange(year, month, period)
  return `${m} • Day ${range.start}–${range.end}`
}

interface StaffAttendanceCalendarModalProps {
  staffId: string
  staffName: string
  empNo: string
  dayRate?: number
  nightRate?: number
  expectedSalary?: number
  onClose: () => void
}

export default function StaffAttendanceCalendarModal({
  staffId,
  staffName,
  empNo,
  dayRate,
  nightRate,
  expectedSalary,
  onClose,
}: StaffAttendanceCalendarModalProps) {
  const [attendance, setAttendance] = useState<any[]>([])
  const [advances, setAdvances] = useState<SalaryAdvance[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date()
  const [periodYear, setPeriodYear] = useState(today.getFullYear())
  const [periodMonth, setPeriodMonth] = useState(today.getMonth())
  const [periodNum, setPeriodNum] = useState<1 | 2>(today.getDate() <= 15 ? 1 : 2)

  const year = periodYear
  const month = periodMonth
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => {
    loadAttendance()
    loadAdvances()
  }, [periodYear, periodMonth, periodNum, staffId])

  const goToPrevPeriod = () => {
    if (periodNum === 1) {
      const prevMonth = periodMonth - 1
      if (prevMonth < 0) {
        setPeriodYear(periodYear - 1)
        setPeriodMonth(11)
      } else {
        setPeriodMonth(prevMonth)
      }
      setPeriodNum(2)
    } else {
      setPeriodNum(1)
    }
  }

  const goToNextPeriod = () => {
    if (periodNum === 2) {
      const nextMonth = periodMonth + 1
      if (nextMonth > 11) {
        setPeriodYear(periodYear + 1)
        setPeriodMonth(0)
      } else {
        setPeriodMonth(nextMonth)
      }
      setPeriodNum(1)
    } else {
      setPeriodNum(2)
    }
  }

  const loadAttendance = async () => {
    setLoading(true)
    try {
      const data = await attendanceService.getStaffMonthAttendance(staffId, year, month)
      setAttendance(data)
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAdvances = async () => {
    try {
      const data = await advanceService.getAdvancesByEmployee(staffId)
      setAdvances(data || [])
    } catch (error) {
      console.error('Error loading advances:', error)
    }
  }

  const getStatusForDay = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0]
    return attendance.find((a) => a.employee_id === staffId && a.attendance_date === dateStr)
      ?.status
  }

  const cycleStatus = async (day: number) => {
    const current = getStatusForDay(day)

    // Determine the cycle based on available rates
    let statuses: (AttendanceRecord['status'] | undefined)[] = []

    if (dayRate && !nightRate) {
      statuses = [undefined, 'Present', 'Absent', 'Late', 'Half-Day']
    } else if (nightRate && !dayRate) {
      statuses = [undefined, 'Present', 'Absent', 'Late', 'Half-Day']
    } else {
      // Both or neither set — use Present for paid attendance
      statuses = [undefined, 'Present', 'Absent', 'Late', 'Half-Day']
    }

    const currentIndex = statuses.indexOf(current)
    const nextIndex = (currentIndex + 1) % statuses.length
    const next = statuses[nextIndex]

    const dateStr = new Date(year, month, day).toISOString().split('T')[0]

    if (next) {
      await attendanceService.upsertAttendance({
        employee_id: staffId,
        attendance_date: dateStr,
        status: next,
      })
    } else {
      await attendanceService.deleteAttendance(staffId, dateStr)
    }
    loadAttendance()
  }

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'Present':
        return 'bg-emerald-500/20 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-500/30 dark:border-emerald-800'
      case 'Absent':
        return 'bg-red-500/20 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-500/30 dark:border-red-800'
      case 'Late':
        return 'bg-amber-500/20 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-500/30 dark:border-amber-800'
      case 'Half-Day':
        return 'bg-blue-500/20 dark:bg-blue-950 text-blue-600 dark:text-blue-300 border-blue-500/30 dark:border-blue-800'
      default:
        return 'bg-gray-50 dark:bg-neutral-800/80 text-gray-400 dark:text-neutral-500 border-gray-200 dark:border-neutral-700'
    }
  }

  const calculateSummary = () => {
    const range = getPeriodRange(year, month, periodNum)
    const staffAttendance = attendance.filter((a) => {
      const day = new Date(a.attendance_date).getDate()
      return a.employee_id === staffId && day >= range.start && day <= range.end
    })

    const absent = staffAttendance.filter((a) => a.status === 'Absent').length
    const late = staffAttendance.filter((a) => a.status === 'Late').length
    const paidDays = getPaidDaysCount(attendance, staffId, range)
    const dailyRate = expectedSalary ? expectedSalary / 30 : 0
    const totalSalary = paidDays * dailyRate
    const totalAdvances = advances
      .filter((a) => a.status === 'Pending')
      .reduce((sum, a) => sum + Number(a.amount_pkr), 0)
    const netSalary = totalSalary - totalAdvances

    return { absent, late, paidDays, totalSalary, totalAdvances, netSalary }
  }

  const summary = calculateSummary()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl dark:shadow-none overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
          <div>
            <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={16} /> Attendance Tracker
            </h3>
            <p className="text-[10px] text-gray-500 dark:text-neutral-400 mt-1">
              {staffName} <span className="text-emerald-500 font-mono">({empNo})</span>
            </p>
            {expectedSalary ? (
              <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                Rs.{Math.round(expectedSalary / 30).toLocaleString()}/shift
              </span>
            ) : dayRate || nightRate ? (
              <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                Rs.{(dayRate || nightRate || 0).toLocaleString()}/shift
              </span>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Calendar */}
        <div className="p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPrevPeriod}
              className="p-2 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700"
            >
              <ChevronLeft size={18} className="text-gray-400 dark:text-neutral-500" />
            </button>
            <h4 className="text-xs font-mono font-bold text-gray-800 dark:text-neutral-100 uppercase tracking-widest">
              {getPeriodLabel(year, month, periodNum)}
            </h4>
            <button
              onClick={goToNextPeriod}
              className="p-2 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700"
            >
              <ChevronRight size={18} className="text-gray-400 dark:text-neutral-500" />
            </button>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-neutral-400 text-xs">
              Loading...
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Day of week headers */}
              {['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'].map((d) => (
                <div
                  key={d}
                  className="text-[8px] text-center font-bold text-gray-400 dark:text-neutral-500 py-1"
                >
                  {d === 'Su' ? 'S' : d === 'Sa' ? 'S' : d}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => (
                <div key={`empty-${i}`} className="h-8" />
              ))}

              {/* Calendar days */}
              {(() => {
                const range = getPeriodRange(year, month, periodNum)
                const isInActivePeriod = (d: number) => d >= range.start && d <= range.end

                return Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const active = isInActivePeriod(day)
                  const status = getStatusForDay(day)
                  const singleRate = expectedSalary
                    ? Math.round(expectedSalary / 30)
                    : dayRate || nightRate || 0
                  const showRate =
                    active && status === 'Present' && singleRate > 0
                  return (
                    <button
                      key={day}
                      onClick={() => active && cycleStatus(day)}
                      className={cn(
                        'rounded border text-[10px] font-bold transition-all flex flex-col items-center justify-center',
                        showRate ? 'h-10' : 'h-8',
                        active && 'hover:scale-105',
                        active
                          ? getStatusColor(status)
                          : 'opacity-30 cursor-default bg-white dark:bg-neutral-900/[0.02] border-gray-200 dark:border-neutral-700'
                      )}
                      title={`${day} - ${active ? status || 'Not marked' : 'Outside period'}${showRate ? ` (Rs ${singleRate}/shift)` : ''}`}
                    >
                      <span>{day}</span>
                      {showRate && (
                        <span className="text-[7px] font-medium leading-none mt-px opacity-80">
                          {status === 'Present' ? '✓' : '?'}
                          {formatRate(singleRate)}
                        </span>
                      )}
                    </button>
                  )
                })
              })()}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-200 dark:border-neutral-700 space-y-2">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-emerald-600 dark:text-emerald-300 font-bold">
                  {summary.paidDays}
                </span>
                <span className="text-gray-400 dark:text-neutral-500 ml-1">Total Working Days</span>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    {summary.late}
                  </span>
                  <span className="text-gray-400 dark:text-neutral-500 ml-1">late</span>
                </div>
                <div>
                  <span className="text-red-600 dark:text-red-400 font-bold">{summary.absent}</span>
                  <span className="text-gray-400 dark:text-neutral-500 ml-1">unpaid</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-gray-200 dark:border-neutral-700">
            <span className="text-gray-500 dark:text-neutral-400 font-semibold">earned salary</span>
            <span className="text-emerald-600 dark:text-emerald-300 font-mono font-bold">
              {formatPKR(summary.totalSalary)}
            </span>
          </div>

          {summary.totalAdvances > 0 && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500 dark:text-neutral-400 font-semibold flex items-center gap-1">
                <Minus size={10} /> advance taken
              </span>
              <span className="text-red-600 dark:text-red-400 font-mono font-bold">
                -{formatPKR(summary.totalAdvances)}
              </span>
            </div>
          )}

          {summary.totalAdvances > 0 && (
            <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-gray-200 dark:border-neutral-700">
              <span className="text-gray-600 dark:text-neutral-300 font-bold flex items-center gap-1">
                <Equal size={11} /> net payable
              </span>
              <span className="text-emerald-600 dark:text-emerald-300 font-mono font-bold">
                {formatPKR(Math.max(0, summary.netSalary))}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
