import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPKR(amount: number) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCNIC(cnic: string) {
  const cleaned = cnic.replace(/\D/g, '')
  if (cleaned.length !== 13) return cnic
  return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`
}

export function formatPhone(phone: string) {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('92')) return `+${cleaned}`
  if (cleaned.startsWith('0')) return `+92 ${cleaned.slice(1)}`
  return phone
}

/** Auto-capitalize name — first letter of each word uppercase, rest lowercase */
export function formatNameInput(value: string): string {
  return value.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Auto-format CNIC as user types: XXXXX-XXXXXXX-X (13 digits with dashes) */
export function formatCNICInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

/** Auto-format Pakistani mobile as user types: 03XX-XXXXXXX (11 digits, dash after 4th) */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 4) return digits
  return `${digits.slice(0, 4)}-${digits.slice(4)}`
}
