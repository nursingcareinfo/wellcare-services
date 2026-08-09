/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/** Props for the ErrorBoundary component. */
export interface ErrorBoundaryProps {
  /** Children to render within the boundary. */
  children: ReactNode
  /**
   * Optional custom fallback UI.
   * Can be a static ReactNode or a render function receiving the error and a reset callback.
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  /** Optional callback invoked when an error is caught. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * A class-based React error boundary that catches JavaScript/TypeScript errors
 * anywhere in its child component tree, logs them, and displays a fallback UI
 * instead of crashing the entire application.
 *
 * Must be a class component — React error boundaries require
 * `getDerivedStateFromError` or `componentDidCatch`, which are only available
 * in class components until React's error boundary hooks proposal lands.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={(error, reset) => (
 *     <div>
 *       <p>{error.message}</p>
 *       <button onClick={reset}>Retry</button>
 *     </div>
 *   )}
 *   onError={(error, errorInfo) => reportError(error, errorInfo)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /** @internal Declared here since @types/react is not installed in this project. */
  declare state: ErrorBoundaryState
  /** @internal Declared here since @types/react is not installed in this project. */
  declare props: ErrorBoundaryProps

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  /** @internal Provides type-safe setState since @types/react is not installed. */
  setState(
    state: ErrorBoundaryState | ((prev: ErrorBoundaryState) => ErrorBoundaryState),
    callback?: () => void
  ): void {
    super.setState?.(state, callback)
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  /** Reset error state, re-rendering children. */
  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderFallback()
    }

    return this.props.children
  }

  private renderFallback(): ReactNode {
    const { fallback } = this.props
    const { error } = this.state

    if (typeof fallback === 'function') {
      return fallback(error!, this.handleReset)
    }

    if (fallback !== undefined) {
      return fallback
    }

    return (
      <div className="glass-card p-8 md:p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center mb-5">
          <AlertTriangle size={28} className="text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-[var(--color-ink)] mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--color-ink-dim)] max-w-md mb-6">
          {error?.message || 'An unexpected error occurred while rendering this section.'}
        </p>
        <button onClick={this.handleReset} className="btn-primary inline-flex items-center gap-2">
          <RefreshCw size={14} />
          Try again
        </button>
      </div>
    )
  }
}

/**
 * Higher-order component that wraps a component with an ErrorBoundary.
 *
 * @param Component - The component to wrap.
 * @param errorBoundaryProps - Optional ErrorBoundary props (fallback, onError).
 * @returns A wrapped component with error boundary protection.
 *
 * @example
 * ```tsx
 * const SafeDashboardView = withErrorBoundary(DashboardView, {
 *   fallback: <div>Dashboard error</div>,
 * })
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'> = {}
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const WithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return WithErrorBoundary
}

export default ErrorBoundary
