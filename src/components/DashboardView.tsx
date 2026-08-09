/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { cn } from '../lib/utils'
import { motion } from 'motion/react'
import { staffService } from '../services/staffService'
import { patientService } from '../services/patientService'
import { supabase } from '../lib/supabase'

export default function DashboardView({ setActiveView }: { setActiveView: (view: any) => void }) {
  const [stats, setStats] = useState([
    { label: 'Active Staff', value: '...', trend: '+0%', color: 'blue' },
    { label: 'Available Now', value: '...', trend: '+0%', color: 'green' },
    { label: 'Active Patients', value: '...', trend: '+0%', color: 'purple' },
    { label: 'Est. MTD Margin', value: '...', trend: '+0%', color: 'emerald', isCurrency: true },
  ])

  const [chartData, setChartData] = useState([
    { name: 'Nurse', total: 0, color: '#3B82F6' },
    { name: 'Care Taker', total: 0, color: '#60A5FA' },
    { name: 'Attendant', total: 0, color: '#10B981' },
    { name: 'Babysitter', total: 0, color: '#F59E0B' },
  ])

  const [fulfillmentRate, setFulfillmentRate] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  async function loadStats() {
    try {
      const [activeStaff, availableStaff, activePatients, allStaff] = await Promise.all([
        staffService.getActiveStaffCount(),
        staffService.getAvailableStaffCount(),
        patientService.getActivePatientsCount(),
        staffService.getAllStaff(),
      ])

      let dailyMargin = 0
      let patientsWithShifts = 0

      try {
        const { data: marginsData } = await supabase
          .from('real_time_margin_view')
          .select('daily_margin, daily_cost')
        if (marginsData) {
          dailyMargin = marginsData.reduce((acc, curr) => acc + Number(curr.daily_margin), 0)
          patientsWithShifts = marginsData.filter((m) => Number(m.daily_cost) > 0).length
        }
      } catch (marginError) {
        console.warn('Margin view not available yet:', marginError)
      }

      const mtdProjected = dailyMargin * 30

      // More accurate Fulfillment Rate: (Patients with active shifts / Total Active Patients)
      const rate = activePatients > 0 ? (patientsWithShifts / activePatients) * 100 : 0
      setFulfillmentRate(Math.min(100, Math.round(rate * 10) / 10))

      setStats([
        { label: 'Active Staff', value: activeStaff.toString(), trend: '+2%', color: 'blue' },
        {
          label: 'Available Now',
          value: availableStaff.toString(),
          trend: '+5%',
          color: 'green',
        },
        {
          label: 'Active Patients',
          value: activePatients.toString(),
          trend: '+12%',
          color: 'purple',
        },
        {
          label: 'Est. MTD Margin',
          value: mtdProjected > 0 ? mtdProjected.toLocaleString() : '---',
          trend: '+18%',
          color: 'emerald',
          isCurrency: true,
        },
      ])

      // Calculate distribution
      const distribution = allStaff.reduce((acc: any, s) => {
        const category = s.category || s.position_applied || 'Nurse'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {})

      // Combine categories for charts
      const categories = [
        {
          name: 'Nurse',
          total:
            (distribution['Nurse'] || 0) +
            (distribution['R/N'] || 0) +
            (distribution['BSN'] || 0) +
            (distribution['Aid Nurse'] || 0),
          color: '#3B82F6',
        },
        {
          name: 'Care Taker',
          total: distribution['Care Taker'] || distribution['Caretaker'] || 0,
          color: '#60A5FA',
        },
        { name: 'Attendant', total: distribution['Attendant'] || 0, color: '#10B981' },
        { name: 'Babysitter', total: distribution['Babysitter'] || 0, color: '#F59E0B' },
      ]
      setChartData(categories)

      // Set recent staff
      setRecentStaff(allStaff.slice(0, 5))
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    }
  }

  async function handleForceRefresh() {
    setIsRefreshing(true)

    setStats([
      { label: 'Active Staff', value: '...', trend: '+0%', color: 'blue' },
      { label: 'Available Now', value: '...', trend: '+0%', color: 'green' },
      { label: 'Active Patients', value: '...', trend: '+0%', color: 'purple' },
      { label: 'Est. MTD Margin', value: '...', trend: '+0%', color: 'emerald', isCurrency: true },
    ])
    setChartData([
      { name: 'Nurse', total: 0, color: '#3B82F6' },
      { name: 'Care Taker', total: 0, color: '#60A5FA' },
      { name: 'Attendant', total: 0, color: '#10B981' },
      { name: 'Babysitter', total: 0, color: '#F59E0B' },
    ])
    setFulfillmentRate(0)
    setRecentStaff([])

    await loadStats()
    setIsRefreshing(false)
  }

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const [recentStaff, setRecentStaff] = useState<any[]>([])

  const calculateAge = (dob: string | undefined) => {
    if (!dob) return null
    try {
      const birthDate = new Date(dob)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const m = today.getMonth() - birthDate.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      return age
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-8 h-full pb-12">
      <div className="flex justify-between items-center bg-gray-50 dark:bg-neutral-800/80 p-4 rounded-xl border border-gray-200 dark:border-neutral-700">
        <div>
          <h2 className="text-sm font-black text-gray-800 dark:text-neutral-100 uppercase tracking-widest flex items-center gap-2">
            Karachi HQ Operational Pulse
          </h2>
          <p className="text-[9px] text-gray-500 dark:text-neutral-400 uppercase font-bold tracking-widest mt-0.5">
            Real-time sync with remote Ledger
          </p>
        </div>
        <button
          onClick={handleForceRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50 text-gray-600 dark:text-neutral-300 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors border border-gray-200 dark:border-neutral-700 flex items-center gap-2"
        >
          {isRefreshing && (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-5 relative overflow-hidden group shadow-2xl dark:shadow-none"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] uppercase font-black text-gray-500 dark:text-neutral-400 tracking-[0.2em] mb-4">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-1">
                  {stat.isCurrency && (
                    <span className="text-[10px] text-emerald-500 font-mono font-bold">PKR</span>
                  )}
                  <div className="text-2xl font-mono font-bold text-gray-800 dark:text-neutral-100 tracking-tighter">
                    {stat.value}
                  </div>
                </div>
              </div>
              <span
                className={cn(
                  'text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest',
                  stat.trend.startsWith('+')
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-500/20'
                )}
              >
                {stat.trend}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 h-1 bg-emerald-500/20 dark:bg-emerald-950 w-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '60%' }}
                className="h-full bg-emerald-500/40"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-neutral-500 mb-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Staff Category Distribution
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E2DC',
                    borderRadius: '8px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 flex flex-col">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-neutral-500 mb-8 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Fulfillment Rate
          </h3>
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  fill="transparent"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="10"
                />
                <circle
                  cx="88"
                  cy="88"
                  r="76"
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="10"
                  strokeDasharray={`${2 * Math.PI * 76}`}
                  strokeDashoffset={`${2 * Math.PI * 76 * (1 - fulfillmentRate / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <div className="text-4xl font-mono font-black text-gray-800 dark:text-neutral-100">
                  {fulfillmentRate}%
                </div>
                <div className="text-[9px] text-gray-500 dark:text-neutral-400 font-black uppercase tracking-[0.15em]">
                  Matched
                </div>
              </div>
            </div>
            <div className="mt-8 w-full space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-gray-500 dark:text-neutral-400 font-mono">
                  Performance Metric
                </span>
                <span className="text-blue-600 dark:text-blue-300">Stable</span>
              </div>
              <div className="text-[10px] text-center text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest px-4 leading-relaxed">
                Target: 90% (Karachi Operations Benchmark)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Staff Activity List */}
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-2xl dark:shadow-none">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-neutral-500 flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Recent Registered Professionals
          </h3>
          <button
            onClick={() => setActiveView('staff')}
            className="text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase tracking-widest hover:underline"
          >
            View All Staff
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 dark:border-neutral-700">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Professional
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  ID
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Category
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Age
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Religion
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Marital
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  District
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Relative
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Address
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  WhatsApp
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentStaff.map((staff) => (
                <tr
                  key={staff.id}
                  className="hover:bg-gray-50 dark:bg-neutral-800/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-neutral-800/80 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase">
                        {(staff.full_name || '?')[0]}
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-gray-800 dark:text-neutral-100">
                          {staff.full_name}
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-neutral-400 font-mono italic">
                          Exp: {staff.experience_years} yrs
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono text-emerald-500 font-bold">
                    {staff.emp_no}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 text-[10px] font-black uppercase tracking-widest border border-blue-200 dark:border-blue-800">
                      {staff.category || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] font-mono">
                    {(() => {
                      const age = calculateAge(staff.dob)
                      return age ? (
                        <span className="text-emerald-600 dark:text-emerald-300 font-bold">
                          {age}
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-black">—</span>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-[10px]">
                    {staff.religion ? (
                      <span className="text-purple-600 dark:text-purple-400 font-bold">
                        {staff.religion}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-black">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[10px]">
                    {staff.marital_status ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        {staff.marital_status}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-black">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
                    {staff.district}
                  </td>
                  <td className="px-6 py-4 text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
                    {staff.father_husband_name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-[10px] text-gray-400 dark:text-neutral-500 font-bold uppercase tracking-widest max-w-[200px] truncate">
                    {staff.complete_address || 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    {staff.whatsapp_number ? (
                      <a
                        href={`https://wa.me/${staff.whatsapp_number.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-600 dark:text-emerald-300 hover:underline font-bold"
                      >
                        {staff.whatsapp_number}
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400 dark:text-neutral-500">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setActiveView('staff')}
                      className="px-3 py-1 bg-gray-50 dark:bg-neutral-800/80 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 rounded-lg text-[10px] font-black text-gray-800 dark:text-neutral-100 uppercase transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {recentStaff.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-6 py-12 text-center text-gray-400 dark:text-neutral-500 text-[10px] font-black uppercase tracking-widest"
                  >
                    No recent registrations detected in ledger
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
