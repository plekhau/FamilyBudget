const DAY_MS = 24 * 60 * 60 * 1000

function toUTC(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function stepMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const year = Math.floor(total / 12)
  const mon = (total % 12) + 1
  return `${year}-${String(mon).padStart(2, '0')}`
}

export function formatMonth(month: string, locale = 'en-US'): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDayHeading(date: string, locale = 'en-US'): string {
  return toUTC(date).toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export function currentWeekStart(): string {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = today.getUTCDay() // 0 = Sunday
  const sinceMonday = (day + 6) % 7
  return toISODate(new Date(today.getTime() - sinceMonday * DAY_MS))
}

export function stepWeek(weekStart: string, delta: number): string {
  return toISODate(new Date(toUTC(weekStart).getTime() + delta * 7 * DAY_MS))
}

function monthName(date: Date, locale: string): string {
  return (
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
      .formatToParts(date)
      .find((p) => p.type === 'month')?.value ?? ''
  )
}

export function formatWeekRange(weekStart: string, locale = 'en-US'): string {
  const start = toUTC(weekStart)
  const end = new Date(start.getTime() + 6 * DAY_MS)
  const opts = { timeZone: 'UTC' } as const
  const year = end.toLocaleDateString(locale, { year: 'numeric', ...opts })
  if (start.getUTCMonth() === end.getUTCMonth()) {
    const month = monthName(end, locale)
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month} ${year}`
  }
  const startMonth = monthName(start, locale)
  const endMonth = monthName(end, locale)
  return `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth} ${year}`
}
