/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react'
import { Wallet, TrendingUp, Package, UserMinus, CheckCircle2, AlertTriangle } from 'lucide-react'
import { cn, formatPKR } from '../lib/utils'

// Mock ledger data
const LEDGER_DATA = [
  {
    patientName: 'Haji Mohammed Yousuf',
    packagePrice: 120000,
    assignments: [
      { staffName: 'Amna Ahmed', rate: 45000, status: 'Completed' },
      { staffName: 'Asad Shah', rate: 45000, status: 'Active' },
    ],
  },
  {
    patientName: 'Mrs. Fatima Zahra',
    packagePrice: 75000,
    assignments: [{ staffName: 'Zubair Khan', rate: 35000, status: 'Completed' }],
  },
]

export default function LedgerView() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 relative overflow-hidden group">
          <p className="text-[10px] uppercase font-black text-gray-500 dark:text-neutral-400 tracking-[0.2em] mb-4">
            Total Monthly Revenue
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-emerald-500 font-mono font-bold">PKR</span>
            <div className="text-2xl font-mono font-bold text-gray-800 dark:text-neutral-100 tracking-tighter">
              {formatPKR(195000).replace('Rs. ', '')}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-500/20 dark:bg-emerald-950"></div>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 relative overflow-hidden group">
          <p className="text-[10px] uppercase font-black text-gray-500 dark:text-neutral-400 tracking-[0.2em] mb-4">
            Staff Liabilities (MTD)
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-red-500 font-mono font-bold">PKR</span>
            <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400 tracking-tighter">
              {formatPKR(125000).replace('Rs. ', '')}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-red-500/20 dark:bg-red-950"></div>
        </div>
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6 relative overflow-hidden group">
          <p className="text-[10px] uppercase font-black text-gray-500 dark:text-neutral-400 tracking-[0.2em] mb-4">
            Projected Margin
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-emerald-500 font-mono font-bold">PKR</span>
            <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-300 tracking-tighter">
              {formatPKR(70000).replace('Rs. ', '')}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-emerald-500/40"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-sm font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
            Active Assignments Wall
          </h2>

          <div className="space-y-4">
            {LEDGER_DATA.map((row, i) => {
              const totalSalaries = row.assignments.reduce((sum, a) => sum + a.rate, 0)
              const marginPct = Math.round(
                ((row.packagePrice - totalSalaries) / row.packagePrice) * 100
              )

              return (
                <div
                  key={i}
                  className="p-4 bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl relative"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-gray-800 dark:text-neutral-100 font-semibold">
                        {row.patientName}
                      </h3>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-300/70 font-mono uppercase tracking-tighter">
                        Package: {formatPKR(row.packagePrice)} / Month
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-bold">
                        Margin: {marginPct}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {row.assignments.map((assignment, j) => (
                      <div
                        key={j}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-800/80 rounded-lg border border-gray-200 dark:border-neutral-700 group hover:border-emerald-500/30 dark:border-emerald-800 transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center font-bold text-xs text-gray-800 dark:text-neutral-100 uppercase">
                          {assignment.staffName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-800 dark:text-neutral-100">
                            {assignment.staffName}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-neutral-500">
                            Manual Entry • Status: {assignment.status}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 dark:text-neutral-400 font-mono">
                            PKR
                          </span>
                          <input
                            type="text"
                            defaultValue={assignment.rate.toLocaleString()}
                            className="w-20 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-2 py-1 text-xs text-emerald-600 dark:text-emerald-300 font-mono focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-neutral-700 flex justify-between items-center">
                    <div className="text-[10px] text-gray-500 dark:text-neutral-400 font-bold uppercase tracking-widest">
                      Verify Shift Completion
                    </div>
                    <button className="px-3 py-1 bg-emerald-500/20 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 text-[10px] rounded border border-emerald-500/30 dark:border-emerald-800 uppercase font-bold hover:bg-emerald-500/30 transition-colors">
                      Confirm Monthly Payout
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar Financials */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-6">
            <h2 className="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-6">
              Financial Ledger
            </h2>

            <div className="space-y-8">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest mb-2 font-bold">
                  Total Staff Liabilities
                </p>
                <div className="flex justify-between items-end border-b border-gray-200 dark:border-neutral-700 pb-2">
                  <span className="text-2xl font-mono text-gray-800 dark:text-neutral-100 font-bold">
                    895,000
                  </span>
                  <span className="text-xs text-gray-400 dark:text-neutral-500 mb-1">PKR</span>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest font-bold">
                  Unpaid Balance (Verified)
                </p>
                <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg group hover:bg-red-50 dark:bg-red-950 transition-colors">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-400 dark:text-neutral-500 font-medium">
                      A. Rehman (JazzCash)
                    </span>
                    <span className="text-gray-800 dark:text-neutral-100 font-mono font-bold">
                      14,500
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full w-3/4 rounded-full"></div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-neutral-800/80 border border-gray-200 dark:border-neutral-700 rounded-lg group hover:bg-gray-100 dark:hover:bg-neutral-800 dark:bg-neutral-800 transition-colors">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 dark:text-neutral-500 font-medium">
                      Z. Almas (Bank Transfer)
                    </span>
                    <span className="text-gray-800 dark:text-neutral-100 font-mono font-bold">
                      32,000
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest mb-3 font-bold">
                  Policy Audit Checks
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700">
                    <span className="text-[10px] text-gray-600 dark:text-neutral-300 font-medium font-mono uppercase tracking-widest">
                      Notice Period Signed
                    </span>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gray-100 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700">
                    <span className="text-[10px] text-gray-600 dark:text-neutral-300 font-medium font-mono uppercase tracking-widest">
                      Abandonment Penalty
                    </span>
                    <div className="relative inline-flex items-center cursor-pointer group">
                      <div className="w-8 h-4 bg-gray-200 rounded-full border border-gray-200 dark:border-neutral-700 group-hover:bg-gray-300 transition-colors"></div>
                      <div className="absolute left-1 w-2 h-2 bg-white dark:bg-neutral-900 rounded-full transition-transform"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full mt-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-xl uppercase tracking-[0.2em] shadow-xl dark:shadow-none shadow-emerald-500/20 transition-all active:scale-[0.98]">
              Process Payout List
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
