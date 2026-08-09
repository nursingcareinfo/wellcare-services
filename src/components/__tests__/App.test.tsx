import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../../App'

vi.mock('@supabase/supabase-js', () => {
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()
  const mockAuth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  }

  // Make from().select() chain return empty data
  mockSelect.mockResolvedValue({ data: [], error: null })
  mockFrom.mockReturnValue({ select: mockSelect })

  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
      from: mockFrom,
    })),
  }
})

describe('App', () => {
  beforeEach(() => {
    // Clear any leftover DOM state
    document.body.innerHTML = ''
  })

  it('renders the dashboard title', async () => {
    render(<App />)

    // App loads asynchronously (AuthProvider checks session),
    // so we wait for the HMSP heading to appear
    const heading = await screen.findByText(/HMSP/i, { selector: 'h1' })
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveTextContent(/High-Performance/i)
  })

  it('renders without crashing', async () => {
    const { container } = render(<App />)

    // Wait for loading to complete
    await screen.findByText(/HMSP/i, { selector: 'h1' })
    expect(container).toBeInTheDocument()
  })
})
