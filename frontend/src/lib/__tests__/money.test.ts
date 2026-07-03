import { formatMoney } from '@/lib/money'

// Intl uses non-breaking spaces (U+00A0 / U+202F) between number and symbol in
// some locales; normalize them so assertions are readable.
function norm(s: string): string {
  // eslint-disable-next-line no-irregular-whitespace
  return s.replace(/[  ]/g, ' ')
}

describe('formatMoney', () => {
  it('formats USD with a bare dollar sign', () => {
    /** String amounts from the API format with $ and two decimals. */
    expect(formatMoney('84.2', 'USD', 'en-US')).toBe('$84.20')
  })

  it('adds thousands separators', () => {
    /** Large amounts get grouped digits. */
    expect(formatMoney(2400, 'USD', 'en-US')).toBe('$2,400.00')
  })

  it('uses the narrow symbol, not a prefixed one', () => {
    /** CAD in en-US must be $ (narrowSymbol), never CA$. */
    expect(formatMoney(5, 'CAD', 'en-US')).toBe('$5.00')
  })

  it('follows the locale convention for symbol placement', () => {
    /** de-DE puts the € after the number with comma decimals. */
    expect(norm(formatMoney(1234.56, 'EUR', 'de-DE'))).toBe('1.234,56 €')
  })
})
