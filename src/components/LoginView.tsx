import { useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginView() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result = await signIn(username, password)
    if (result.error) {
      setError(result.error)
    }
    setIsSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-emerald-500/3 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative"
      >
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter text-gray-800 dark:text-neutral-100">
            WellCare <span className="text-emerald-500">Home Nursing</span>
          </h1>
          <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-[0.2em] mt-2 font-bold">
            Services
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-2xl p-8 shadow-2xl dark:shadow-none">
          <div className="mb-6">
            <h2 className="text-sm font-black text-gray-800 dark:text-neutral-100 uppercase tracking-[0.15em]">
              Sign In
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-neutral-400 uppercase tracking-widest mt-1 font-bold">
              Authorized personnel only
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="sobil_admin"
                className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40 transition-colors placeholder:text-gray-500 dark:text-neutral-400"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-gray-400 dark:text-neutral-500 uppercase tracking-[0.15em] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-gray-800 dark:text-neutral-100 text-sm outline-none focus:border-emerald-500/40 transition-colors placeholder:text-gray-500 dark:text-neutral-400 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500 hover:text-gray-400 dark:text-neutral-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-2 bg-red-500/5 border border-red-500/10 rounded-xl p-3"
              >
                <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-300/80 font-medium">{error}</p>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-black text-[10px] uppercase tracking-[0.2em] py-3.5 rounded-xl transition-all duration-200"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={14} />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-[9px] text-gray-500 dark:text-neutral-400 text-center mt-6 uppercase tracking-widest font-bold">
          WellCare Home Nursing Services v1.0 &middot; Karachi
        </p>
      </motion.div>
    </div>
  )
}
