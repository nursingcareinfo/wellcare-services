import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * WellCare local auth gate.
 *
 * UI gate (not server auth): validates the fixed owner credentials in-memory
 * and keeps a session flag in localStorage. The app's data layer remains
 * anon-access Supabase — this only gates the dashboard itself.
 */
interface AuthContextType {
  user: { username: string } | null
  session: string | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const WELLCARE_USERNAME = 'sobil_admin'
const WELLCARE_PASSWORD = 'sobiladmin321321'
const SESSION_KEY = 'wellcare_session'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ username: string } | null>(null)
  const [session, setSession] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore a persisted session.
    try {
      if (localStorage.getItem(SESSION_KEY) === '1') {
        setUser({ username: WELLCARE_USERNAME })
        setSession('1')
      }
    } catch {
      // localStorage unavailable — start logged out.
    }
    setLoading(false)
  }, [])

  const signIn = async (username: string, password: string) => {
    if (username.trim() === WELLCARE_USERNAME && password === WELLCARE_PASSWORD) {
      try {
        localStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Non-persistent session only.
      }
      setUser({ username: WELLCARE_USERNAME })
      setSession('1')
      return { error: null }
    }
    return { error: 'Invalid username or password' }
  }

  const signOut = async () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}