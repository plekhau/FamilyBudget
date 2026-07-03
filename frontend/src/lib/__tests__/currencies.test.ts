import { CURRENCIES, defaultCurrencyForLocale } from '@/lib/currencies'

describe('CURRENCIES', () => {
  it('contains unique 3-letter codes with symbol and name', () => {
    /** Every catalog entry has a unique uppercase 3-letter code plus a non-empty symbol and name. */
    const codes = CURRENCIES.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of CURRENCIES) {
      expect(c.code).toMatch(/^[A-Z]{3}$/)
      expect(c.symbol.length).toBeGreaterThan(0)
      expect(c.name.length).toBeGreaterThan(0)
    }
  })

  it('includes the majors', () => {
    /** USD, EUR and GBP are always available. */
    const codes = CURRENCIES.map((c) => c.code)
    expect(codes).toEqual(expect.arrayContaining(['USD', 'EUR', 'GBP']))
  })
})

describe('defaultCurrencyForLocale', () => {
  it('maps a German locale to EUR', () => {
    /** de-DE resolves to region DE which uses the euro. */
    expect(defaultCurrencyForLocale('de-DE')).toBe('EUR')
  })

  it('maps a US locale to USD', () => {
    /** en-US resolves to region US. */
    expect(defaultCurrencyForLocale('en-US')).toBe('USD')
  })

  it('maps a bare language to its likely region currency', () => {
    /** 'pl' maximizes to pl-PL, so PLN. */
    expect(defaultCurrencyForLocale('pl')).toBe('PLN')
  })

  it('falls back to USD for unknown input', () => {
    /** Unmappable locales fall back to USD rather than throwing. */
    expect(defaultCurrencyForLocale('zz-ZZ')).toBe('USD')
    expect(defaultCurrencyForLocale('not a locale !!!')).toBe('USD')
  })
})
