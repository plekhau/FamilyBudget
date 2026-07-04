import { spaceLocale, SUPPORTED_LOCALES } from '../locale'

describe('spaceLocale', () => {
  it('returns the space locale when set', () => {
    /** A non-empty space locale wins over the browser locale. */
    expect(spaceLocale({ locale: 'de-DE' })).toBe('de-DE')
  })

  it('falls back to navigator.language when unset', () => {
    /** Empty string or undefined means auto (browser). */
    expect(spaceLocale({ locale: '' })).toBe(navigator.language)
    expect(spaceLocale({})).toBe(navigator.language)
  })
})

describe('SUPPORTED_LOCALES', () => {
  it('starts with the auto option', () => {
    /** The first entry is the empty-code Auto (browser) option. */
    expect(SUPPORTED_LOCALES[0]).toEqual({ code: '', label: 'Auto (browser)' })
  })
})
