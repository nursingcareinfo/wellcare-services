import { describe, it, expect } from 'vitest'
import { formatPNCInput, formatCNICInput, formatPhoneInput, formatNameInput } from '../utils'

describe('formatPNCInput', () => {
  it('uppercases letters and strips spaces', () => {
    expect(formatPNCInput('pk-s-25-w-366996')).toBe('PK-S-25-W-366996')
  })

  it('keeps the short A-XXXXX form', () => {
    expect(formatPNCInput('a-54887')).toBe('A-54887')
  })

  it('strips invalid characters', () => {
    expect(formatPNCInput('PK K-22-A 290169!')).toBe('PKK-22-A290169')
  })

  it('tolerates empty input', () => {
    expect(formatPNCInput('')).toBe('')
  })
})

describe('formatCNICInput', () => {
  it('formats 13 digits into XXXXX-XXXXXXX-X', () => {
    expect(formatCNICInput('4230109329633')).toBe('42301-0932963-3')
  })

  it('partially formats while typing', () => {
    expect(formatCNICInput('423010932')).toBe('42301-0932')
  })
})

describe('formatPhoneInput', () => {
  it('formats 11 digits into 03XX-XXXXXXX', () => {
    expect(formatPhoneInput('03401807748')).toBe('0340-1807748')
  })
})

describe('formatNameInput', () => {
  it('capitalizes each word', () => {
    expect(formatNameInput('samona pervez')).toBe('Samona Pervez')
  })
})
