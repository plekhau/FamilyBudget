import {
  currentMonth,
  stepMonth,
  formatMonth,
  formatDayHeading,
  currentWeekStart,
  stepWeek,
  formatWeekRange,
} from '@/lib/dates'

describe('month helpers', () => {
  it('returns the current month as YYYY-MM', () => {
    /** currentMonth matches the wall clock. */
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
  })

  it('steps months forward and backward across year boundaries', () => {
    /** stepMonth handles December→January and January→December. */
    expect(stepMonth('2026-12', 1)).toBe('2027-01')
    expect(stepMonth('2026-01', -1)).toBe('2025-12')
    expect(stepMonth('2026-05', 1)).toBe('2026-06')
  })

  it('formats a month for display', () => {
    /** '2026-05' renders as a month name plus year. */
    expect(formatMonth('2026-05')).toBe('May 2026')
  })
})

describe('day heading', () => {
  it('formats an ISO date as weekday + month + day', () => {
    /** 2026-05-14 is a Thursday. */
    expect(formatDayHeading('2026-05-14')).toBe('Thu, May 14')
  })
})

describe('week helpers', () => {
  it('returns a Monday for the current week start', () => {
    /** Weeks are ISO — currentWeekStart is always a Monday. */
    const [y, m, d] = currentWeekStart().split('-').map(Number)
    expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1)
  })

  it('steps whole weeks', () => {
    /** stepWeek moves exactly 7 days, crossing month boundaries. */
    expect(stepWeek('2026-05-11', 1)).toBe('2026-05-18')
    expect(stepWeek('2026-05-04', -1)).toBe('2026-04-27')
  })

  it('formats a same-month week range compactly', () => {
    /** Both ends in May collapse the month name. */
    expect(formatWeekRange('2026-05-11')).toBe('11–17 May 2026')
  })

  it('formats a cross-month week range with both months', () => {
    /** 27 Apr–3 May spans two months. */
    expect(formatWeekRange('2026-04-27')).toBe('27 Apr – 3 May 2026')
  })
})

describe('locale-aware formatting', () => {
  it('formats the month heading in the given locale', () => {
    /** formatMonth honors an explicit locale and defaults to en-US. */
    expect(formatMonth('2026-07', 'de-DE')).toBe('Juli 2026')
    expect(formatMonth('2026-07')).toBe('July 2026')
  })

  it('formats day headings in the given locale', () => {
    /** formatDayHeading renders localized weekday/month names. */
    expect(formatDayHeading('2026-07-06', 'de-DE')).toMatch(/Juli/)
    expect(formatDayHeading('2026-07-06')).toBe('Mon, Jul 6')
  })

  it('formats week ranges in the given locale', () => {
    /** formatWeekRange uses localized month names. */
    expect(formatWeekRange('2026-06-29', 'de-DE')).toMatch(/Juli 2026/)
  })
})
