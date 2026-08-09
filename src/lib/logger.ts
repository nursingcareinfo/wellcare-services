type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

const LOG_COLORS: Record<LogLevel, string> = {
  INFO: '\x1b[36m', // cyan
  WARN: '\x1b[33m', // yellow
  ERROR: '\x1b[31m', // red
  DEBUG: '\x1b[90m', // grey
}

const RESET = '\x1b[0m'

function formatTimestamp(): string {
  return new Date().toISOString()
}

function formatLog(level: LogLevel, message: string, data: unknown[]): string {
  const timestamp = formatTimestamp()
  const prefix = `[${timestamp}] [${level}]`
  const color = LOG_COLORS[level]

  if (data.length === 0) return `${color}${prefix} ${message}${RESET}`

  const serialized = data
    .map((d) => (typeof d === 'object' ? JSON.stringify(d, null, 0) : String(d)))
    .join(' ')

  return `${color}${prefix} ${message} ${serialized}${RESET}`
}

function shouldLog(level: LogLevel): boolean {
  if (import.meta.env.PROD) {
    return level === 'WARN' || level === 'ERROR'
  }
  return true
}

interface Logger {
  /** Log an informational message. In production, these are stripped. */
  info(message: string, ...data: unknown[]): void

  /** Log a warning message. Always visible. */
  warn(message: string, ...data: unknown[]): void

  /** Log an error message. Always visible. */
  error(message: string, ...data: unknown[]): void

  /** Log a debug message. In production, these are stripped. */
  debug(message: string, ...data: unknown[]): void
}

export const logger: Logger = {
  info(message: string, ...data: unknown[]) {
    if (!shouldLog('INFO')) return
    console.info(formatLog('INFO', message, data))
  },

  warn(message: string, ...data: unknown[]) {
    if (!shouldLog('WARN')) return
    console.warn(formatLog('WARN', message, data))
  },

  error(message: string, ...data: unknown[]) {
    if (!shouldLog('ERROR')) return
    console.error(formatLog('ERROR', message, data))
  },

  debug(message: string, ...data: unknown[]) {
    if (!shouldLog('DEBUG')) return
    console.debug(formatLog('DEBUG', message, data))
  },
}

export default logger
