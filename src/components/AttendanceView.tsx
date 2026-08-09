import React, { useState, useEffect } from 'react'
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Download } from 'lucide-react'
import { attendanceService, type AttendanceRecord } from '../services/attendanceService'
import { staffService } from '../services/staffService'
import { cn } from '../lib/utils'

export default function AttendanceView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [staff, setStaff] = useState<any[]>([])
  const [attendance, setAttendance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showSalaryModal, setShowSalaryModal] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  useEffect(() => {
    loadData()
  }, [year, month])

  const loadData = async () => {
    setLoading(true)
    try {
      const [staffData, attendanceData] = await Promise.all([
        staffService.getAllStaff(),
        attendanceService.getMonthAttendance(year, month),
      ])
      setStaff(staffData.filter((s: any) => s.is_active))
      setAttendance(attendanceData)
    } catch (error) {
      console.error('Error loading attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusForStaffDay = (staffId: string, day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0]
    return attendance.find((a) => a.employee_id === staffId && a.attendance_date === dateStr)
      ?.status
  }

  const cycleStatus = async (staffId: string, day: number) => {
    const current = getStatusForStaffDay(staffId, day)
    const cycle: Record<string, AttendanceRecord['status'] | undefined> = {
      undefined: 'Present',
      Present: 'Absent',
      Absent: 'Late',
      Late: 'Half-Day',
      'Half-Day': undefined,
    }
    const next = cycle[current ?? 'undefined']

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
    loadData()
  }

  const getWorkingDays = (staffId: string) => {
    const staffAttendance = attendance.filter((a) => a.employee_id === staffId)
    const present = staffAttendance.filter((a) => a.status === 'Present').length
    const halfDay = staffAttendance.filter((a) => a.status === 'Half-Day').length
    return present + halfDay * 0.5
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

  const calculateSalary = (staffMember: any) => {
    const dailyRate = staffMember.expected_salary_pkr / 30
    const staffAttendance = attendance.filter((a) => a.employee_id === staffMember.id)

    const present = staffAttendance.filter((a) => a.status === 'Present').length
    const halfDay = staffAttendance.filter((a) => a.status === 'Half-Day').length
    const late = staffAttendance.filter((a) => a.status === 'Late').length

    const presentDays = present + halfDay * 0.5
    const lateDeduction = late * (dailyRate * 0.1)
    const totalSalary = presentDays * dailyRate - lateDeduction

    return { present, halfDay, late, dailyRate, lateDeduction, totalSalary }
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-6 rounded-xl">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-neutral-100 uppercase tracking-tighter flex items-center gap-2">
            <Calendar className="text-blue-500" /> Attendance Ledger
          </h2>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black mt-1">
            Mark daily presence • Auto-calculate payroll
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowSalaryModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <DollarSign size={14} /> Calculate Salary
          </button>
          <button
            onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="p-2 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700"
          >
            <ChevronLeft size={20} className="text-gray-400 dark:text-neutral-500" />
          </button>
          <h3 className="text-sm font-mono font-bold text-gray-800 dark:text-neutral-100 uppercase tracking-widest w-32 text-center">
            {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="p-2 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700"
          >
            <ChevronRight size={20} className="text-gray-400 dark:text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-neutral-400 text-xs uppercase tracking-widest">
              Loading...
            </div>
          </div>
        ) : (
          <div className="min-w-[800px]">
            {/* Header Row */}
            <div className="grid grid-cols-[200px_repeat(31,1fr)_80px] gap-1 mb-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 py-2">
                Staff Member
              </div>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <div
                  key={i}
                  className="text-[8px] text-center font-bold text-gray-400 dark:text-neutral-500 py-2 border-b border-gray-200 dark:border-neutral-700"
                >
                  {i + 1}
                </div>
              ))}
              <div className="text-[8px] text-center font-bold text-gray-400 dark:text-neutral-500 py-2 border-b border-gray-200 dark:border-neutral-700">
                Work
              </div>
            </div>

            {/* Staff Rows */}
            {staff.map((s) => (
              <div key={s.id} className="grid grid-cols-[200px_repeat(31,1fr)_80px] gap-1 mb-1">
                <div className="text-[10px] font-bold text-gray-800 dark:text-neutral-100 py-2 truncate pr-2">
                  {s.full_name}
                </div>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const status = getStatusForStaffDay(s.id, i + 1)
                  return (
                    <button
                      key={i}
                      onClick={() => cycleStatus(s.id, i + 1)}
                      className={cn(
                        'h-8 rounded border text-[8px] font-bold transition-all hover:scale-105',
                        getStatusColor(status)
                      )}
                    >
                      {status?.[0] || ''}
                    </button>
                  )
                })}
                <div className="h-8 rounded flex items-center justify-center text-[10px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-950 border border-emerald-500/20">
                  {getWorkingDays(s.id)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Salary Modal */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl shadow-2xl dark:shadow-none overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-700">
              <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-300 uppercase tracking-[0.2em] flex items-center gap-2">
                <DollarSign size={16} /> Monthly Salary Breakdown
              </h3>
              <button
                onClick={() => setShowSalaryModal(false)}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-100"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[60vh]">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-neutral-700">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                      Staff
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                      Present
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                      Daily Rate
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                      Deductions
                    </th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 text-right">
                      Net Pay
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {staff.map((s) => {
                    const calc = calculateSalary(s)
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                        <td className="px-4 py-3 text-[11px] font-bold text-gray-800 dark:text-neutral-100">
                          {s.full_name}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-emerald-600 dark:text-emerald-300">
                          {calc.present} days
                        </td>
                        <td className="px-4 py-3 text-[10px] text-gray-400 dark:text-neutral-500">
                          PKR {calc.dailyRate.toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-[10px] text-red-600 dark:text-red-400">
                          -{calc.lateDeduction.toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-300 text-right">
                          PKR {calc.totalSalary.toFixed(0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-neutral-700 flex justify-end gap-3">
              <button className="btn-secondary flex items-center gap-2">
                <Download size={14} /> Export CSV
              </button>
              <button onClick={() => setShowSalaryModal(false)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
