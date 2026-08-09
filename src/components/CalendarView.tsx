import React, { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { cn, formatPKR } from '../lib/utils'
import { shiftService } from '../services/shiftService'

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [shifts, setShifts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    async function loadShifts() {
      setLoading(true)
      try {
        const data = await shiftService.getShiftsByMonth(year, month)
        setShifts(data)
      } catch (error) {
        console.error('Error fetching shifts:', error)
      } finally {
        setLoading(false)
      }
    }
    loadShifts()
  }, [year, month])

  const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay()

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const totalDays = daysInMonth(year, month)
  const startOffset = firstDayOfMonth(year, month)

  const days = []
  for (let i = 0; i < startOffset; i++) {
    days.push(null)
  }
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i))
  }

  const getDayShifts = (date: Date) => {
    const dStr = date.toISOString().split('T')[0]
    return shifts.filter((s) => s.shift_date === dStr)
  }

  const selectedDayShifts = selectedDate ? getDayShifts(selectedDate) : []

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex justify-between items-center bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 p-6 rounded-xl shadow-2xl dark:shadow-none">
        <div>
          <h2 className="text-xl font-black text-gray-800 dark:text-neutral-100 uppercase tracking-tighter flex items-center gap-2">
            <CalendarIcon className="text-blue-500" /> Attendance Management
          </h2>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-black mt-1">
            Operational Shift Ledger • {monthNames[month]} {year}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-400 dark:text-neutral-500" />
          </button>
          <h3 className="text-sm font-mono font-bold text-gray-800 dark:text-neutral-100 uppercase tracking-widest w-32 text-center">
            {monthNames[month]}
          </h3>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700 transition-colors"
          >
            <ChevronRight size={20} className="text-gray-400 dark:text-neutral-500" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 overflow-hidden">
        <div className="lg:col-span-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 shadow-2xl dark:shadow-none flex flex-col h-full overflow-hidden">
          <div className="grid grid-cols-7 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="text-[10px] text-center font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 py-2 border-b border-gray-200 dark:border-neutral-700"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 flex-1 overflow-auto scrollbar-none relative">
            {loading && (
              <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="text-blue-500 animate-spin" size={32} />
              </div>
            )}
            {days.map((date, i) => {
              if (!date)
                return (
                  <div
                    key={i}
                    className="aspect-square border border-gray-200 dark:border-neutral-700 opacity-10"
                  ></div>
                )

              const dayShifts = getDayShifts(date)
              const isSelected = selectedDate?.toDateString() === date.toDateString()
              const isToday = new Date().toDateString() === date.toDateString()

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'aspect-square border border-gray-200 dark:border-neutral-700 p-2 cursor-pointer transition-all hover:bg-gray-50 dark:bg-neutral-800/80 flex flex-col items-start gap-1',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950 border-blue-500/30 dark:border-blue-800'
                      : '',
                    isToday
                      ? 'relative before:absolute before:top-2 before:right-2 before:w-1.5 before:h-1.5 before:bg-blue-500 before:rounded-full'
                      : ''
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] font-mono font-bold',
                      isSelected
                        ? 'text-blue-600 dark:text-blue-300'
                        : 'text-gray-500 dark:text-neutral-400'
                    )}
                  >
                    {date.getDate()}
                  </span>

                  <div className="flex flex-col gap-1 w-full overflow-hidden">
                    {dayShifts.map((s, idx) => (
                      <div
                        key={idx}
                        title={`${s.staff?.full_name} - ${s.shift_type}`}
                        className={cn(
                          'h-1.5 rounded-full w-full',
                          s.is_completed
                            ? 'bg-emerald-500/40'
                            : s.is_abandoned
                              ? 'bg-red-500/40'
                              : 'bg-gray-300'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-hidden">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-neutral-500 px-2 flex items-center gap-2">
            <Clock size={14} className="text-emerald-600 dark:text-emerald-300" /> Shift Details
          </h3>
          <div className="flex-1 overflow-auto space-y-4 pr-1 scrollbar-none">
            {!selectedDate ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl opacity-40">
                <CalendarIcon size={32} className="text-gray-500 dark:text-neutral-400 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Pick a date to audit shifts
                </p>
              </div>
            ) : (
              <>
                <h4 className="text-[10px] text-gray-800 dark:text-neutral-100 font-mono font-bold uppercase tracking-widest px-2 mb-4">
                  {selectedDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h4>

                {selectedDayShifts.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-gray-200 dark:border-neutral-700 rounded-xl opacity-40">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-black uppercase tracking-widest leading-relaxed">
                      No shifts logged for
                      <br />
                      this date.
                    </p>
                  </div>
                ) : (
                  selectedDayShifts.map((s: any) => (
                    <div
                      key={s.id}
                      className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 space-y-4 group hover:border-gray-200 dark:hover:border-neutral-700 dark:border-neutral-700 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center border border-gray-200 dark:border-neutral-700">
                            <User size={14} className="text-emerald-600 dark:text-emerald-300" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-neutral-100 uppercase tracking-tight">
                              {s.employee?.full_name}
                            </p>
                            <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest">
                              Shift: {s.shift_type} (12h)
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest',
                            s.attendance_status === 'Completed'
                              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300'
                              : s.attendance_status === 'Abandoned'
                                ? 'bg-red-50 dark:bg-red-950 border-red-500/20 text-red-600 dark:text-red-400'
                                : 'bg-gray-100 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-400 dark:text-neutral-500'
                          )}
                        >
                          {s.attendance_status}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200 dark:border-neutral-700 flex justify-between items-center">
                        <div className="text-[9px] text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest">
                          Rate (PKR)
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-300">
                          {s.decided_rate_pkr.toLocaleString()}
                          {s.penalty_applied && (
                            <span className="ml-2 text-red-500 text-[10px]">(Penalty Applied)</span>
                          )}
                        </div>
                      </div>

                      {s.attendance_status === 'Scheduled' && (
                        <div className="pt-4 grid grid-cols-2 gap-2">
                          <button
                            onClick={async () => {
                              await shiftService.updateShiftStatus(s.id, 'Completed')
                              const data = await shiftService.getShiftsByMonth(year, month)
                              setShifts(data)
                            }}
                            className="py-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-500/20 dark:bg-emerald-950 transition-all flex items-center justify-center gap-1"
                          >
                            <CheckCircle2 size={12} /> Complete
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  "Mark shift as abandoned? This will apply a penalty (withholding one day's pay) as per policy."
                                )
                              ) {
                                await shiftService.updateShiftStatus(s.id, 'Abandoned', true)
                                const data = await shiftService.getShiftsByMonth(year, month)
                                setShifts(data)
                              }
                            }}
                            className="py-2 bg-red-50 dark:bg-red-950 border border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500/20 dark:bg-red-950 transition-all flex items-center justify-center gap-1"
                          >
                            <XCircle size={12} /> Abandoned
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}

                <button className="w-full mt-4 py-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 font-black text-xs rounded-xl uppercase tracking-[0.2em] hover:bg-emerald-500/20 dark:bg-emerald-950 transition-all">
                  Log New Manual Override
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
