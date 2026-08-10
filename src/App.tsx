/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ClipboardList,
  Wallet,
  MessageSquare,
  MessageCircle,
  Brain,
  ChevronRight,
  Menu,
  X,
  Share2,
  UserCheck,
  Moon,
  Sun,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from './lib/utils'
import { supabase } from './lib/supabase'

// Direct WhatsApp contact for clients/prospects.
const WHATSAPP_NUMBER = '923433536953'
const WHATSAPP_MESSAGE =
  'Only for home care agency owners! No more manual entries on register, no more mistakes. ' +
  'Patient billing and invoices, equipment rental management, nursing staff duties ' +
  'assignment, attendance, salaries — everything is automated. And this system is FREE.'

type View =
  | 'dashboard'
  | 'staff'
  | 'patients'
  | 'matchmaker'
  | 'finance'
  | 'ocr'
  | 'attendance'
  | 'memory'
  | 'patient_intakes'
  | 'staff_intakes'

// Views are lazy-loaded so heavy deps (recharts, @google/genai) ship in
// per-view chunks instead of one 1.5 MB initial bundle.
const StaffView = lazy(() => import('./components/StaffView'))
const OCRView = lazy(() => import('./components/OCRView'))
const PatientView = lazy(() => import('./components/PatientView'))
const MatchmakerView = lazy(() => import('./components/MatchmakerView'))
const DashboardView = lazy(() => import('./components/DashboardView'))
const FinanceView = lazy(() => import('./components/FinanceView'))
const MemoryView = lazy(() => import('./components/MemoryView'))
const AttendanceView = lazy(() => import('./components/AttendanceView'))
const PatientIntakesView = lazy(() => import('./components/PatientIntakesView'))
const StaffIntakesView = lazy(() => import('./components/StaffIntakesView'))
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginView from './components/LoginView'
import ShareIntakeModal from './components/ShareIntakeModal'
import { ErrorBoundary } from './components/ErrorBoundary'

function AppContent() {
  const { user, loading, signOut } = useAuth()
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [isSidebarOpen, setSidebarOpen] = useState(true)
  const [showShare, setShowShare] = useState(false)
  const [highlightedPatientId, setHighlightedPatientId] = useState<string | null>(null)

  const menuItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'staff', label: 'Staff Tool', icon: Users },
    { id: 'ocr', label: 'Registration', icon: UserPlus },
    { id: 'patients', label: 'Patients', icon: ClipboardList },
    { id: 'attendance', label: 'Attendance', icon: ClipboardList },
    { id: 'patient_intakes', label: 'Patient Intakes', icon: MessageSquare },
    { id: 'staff_intakes', label: 'Staff Intakes', icon: UserCheck },
  ]

  const [mtdMargin, setMtdMargin] = useState<number>(0)

  // Theme toggle
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('hmsp-theme')
    return saved === 'dark'
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('hmsp-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('hmsp-theme', 'light')
    }
  }, [isDark])

  useEffect(() => {
    async function loadMtdMargin() {
      try {
        const { data } = await supabase.from('real_time_margin_view').select('daily_margin')
        if (data) {
          const total = data.reduce((acc: number, curr: any) => acc + Number(curr.daily_margin), 0)
          setMtdMargin(total * 30) // Project MTD based on current daily run rate
        }
      } catch (error) {
        console.error('Error fetching MTD margin:', error)
      }
    }
    loadMtdMargin()
    // Refresh every 5 mins
    const interval = setInterval(loadMtdMargin, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Loading state
  if (loading) {
    return (
      <div className="h-screen bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500/30 dark:border-emerald-800 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    )
  }

  // Auth gate: only the WellCare owner credentials (sobil_admin) unlock the dashboard.
  if (!user) {
    return <LoginView />
  }

  return (
    <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-ink)] overflow-hidden font-sans">
      {/* Sidebar - Desktop Only */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="bg-white dark:bg-neutral-900 border-r border-[var(--color-border)] hidden md:flex flex-col overflow-hidden z-20"
      >
        <div className="p-6 flex items-center justify-between mb-8">
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-black text-xl tracking-tighter text-gray-800 dark:text-neutral-100"
            >
              <span className="leading-tight">
                WellCare{' '}
                <span className="text-emerald-600 dark:text-emerald-300">Home Nursing</span>
                <span className="block text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink-dim)] mt-0.5">
                  Services
                </span>
              </span>
            </motion.div>
          )}
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors text-[var(--color-ink-dim)]"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group uppercase tracking-[0.15em] text-[10px] font-black',
                activeView === item.id
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
              )}
            >
              <item.icon
                size={16}
                className={cn(
                  'shrink-0',
                  activeView === item.id
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'group-hover:text-emerald-500/50'
                )}
              />
              {isSidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-[var(--color-border)] space-y-2">
          <div className="w-full flex items-center gap-3 p-3 text-emerald-600 dark:text-emerald-300 uppercase text-[9px] font-black tracking-[0.2em] px-6">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(5,150,105,0.3)]" />
            {isSidebarOpen && <span>Demo Mode</span>}
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-[var(--color-ink-dim)] hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-[var(--color-ink)] transition-all text-[10px] font-black uppercase tracking-[0.15em]"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isSidebarOpen && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-auto pb-24 md:pb-8 p-4 md:p-8">
        <ErrorBoundary>
          <header className="mb-8 flex flex-col md:flex-row md:justify-between md:items-center border-b border-[var(--color-border)] pb-6 gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tighter text-gray-800 dark:text-neutral-100">
                WellCare{' '}
                <span className="text-emerald-600 dark:text-emerald-300 uppercase">
                  Home Nursing
                </span>
                <span className="block text-sm md:text-base font-bold text-[var(--color-ink-dim)] mt-1 uppercase tracking-wide">
                  Services
                </span>
              </h1>
              <p className="text-[10px] text-[var(--color-ink-dim)] uppercase tracking-widest mt-1 font-bold flex items-center gap-2">
                Manual Management • Karachi HQ • Karachi-S1
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 text-[8px] font-black tracking-[0.2em]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  DEMO
                </span>
              </p>
            </div>

            <div className="flex gap-4 md:gap-8 items-center justify-between md:justify-end">
              <div className="text-right">
                <p className="text-[10px] text-[var(--color-ink-dim)] uppercase tracking-widest font-black mb-1">
                  Estimated MTD Margin
                </p>
                <p className="text-xl md:text-2xl font-mono text-emerald-600 dark:text-emerald-300 font-bold tracking-tighter">
                  PKR {mtdMargin.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(5,150,105,0.4)]"></div>
                </div>
              </div>
            </div>
          </header>

          <div className="mb-8 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-ink-dim)] uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                {activeView.replace('-', ' ')}
              </h2>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-24">
                    <div className="w-6 h-6 border-2 border-emerald-500/30 dark:border-emerald-800 border-t-emerald-400 rounded-full animate-spin" />
                  </div>
                }
              >
                {activeView === 'dashboard' && (
                  <ErrorBoundary>
                    <DashboardView setActiveView={setActiveView} />
                  </ErrorBoundary>
                )}
                {activeView === 'staff' && (
                  <ErrorBoundary>
                    <StaffView
                      setActiveView={setActiveView}
                      onSelectPatient={setHighlightedPatientId}
                    />
                  </ErrorBoundary>
                )}
                {activeView === 'ocr' && (
                  <ErrorBoundary>
                    <OCRView />
                  </ErrorBoundary>
                )}
                {activeView === 'patients' && (
                  <ErrorBoundary>
                    <PatientView
                      highlightedPatientId={highlightedPatientId}
                      onClearHighlight={() => setHighlightedPatientId(null)}
                    />
                  </ErrorBoundary>
                )}
                {activeView === 'matchmaker' && (
                  <ErrorBoundary>
                    <MatchmakerView />
                  </ErrorBoundary>
                )}
                {activeView === 'attendance' && (
                  <ErrorBoundary>
                    <AttendanceView />
                  </ErrorBoundary>
                )}
                {activeView === 'memory' && (
                  <ErrorBoundary>
                    <MemoryView />
                  </ErrorBoundary>
                )}
                {activeView === 'patient_intakes' && (
                  <ErrorBoundary>
                    <PatientIntakesView />
                  </ErrorBoundary>
                )}
                {activeView === 'staff_intakes' && (
                  <ErrorBoundary>
                    <StaffIntakesView />
                  </ErrorBoundary>
                )}
                {activeView === 'finance' && (
                  <ErrorBoundary>
                    <FinanceView />
                  </ErrorBoundary>
                )}

                {activeView === 'whatsapp' && (
                  <div className="glass-card p-12 text-center opacity-50">
                    <MessageSquare size={48} className="mx-auto mb-4" />
                    <h2 className="text-xl font-medium">WhatsApp Analytics</h2>
                    <p>Broadcast engagement and contact label tracking coming in Phase 2.</p>
                  </div>
                )}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>

        {/* Mobile Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-neutral-900/80 backdrop-blur-xl border-t border-[var(--color-border)] flex items-center justify-around px-2 z-50 md:hidden pb-safe">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={cn(
                'flex flex-col items-center gap-1 p-2 transition-all',
                activeView === item.id
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-[var(--color-ink-dim)]'
              )}
            >
              <item.icon size={20} />
              <span className="text-[8px] font-black uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>
      </main>

      {/* WhatsApp Contact FAB */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-40 md:bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-[#25D366] hover:bg-[#1fb958] text-white shadow-lg dark:shadow-none shadow-emerald-600/20 flex items-center justify-center transition-all hover:scale-105"
        aria-label="Contact the owner on WhatsApp"
      >
        <MessageCircle size={22} />
      </a>

      {/* Share Intake FAB */}
      <button
        onClick={() => setShowShare(true)}
        className="fixed bottom-24 md:bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg dark:shadow-none shadow-emerald-600/20 flex items-center justify-center transition-all hover:scale-105"
        aria-label="Share intake form link"
      >
        <Share2 size={20} />
      </button>
      <ShareIntakeModal open={showShare} onClose={() => setShowShare(false)} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
