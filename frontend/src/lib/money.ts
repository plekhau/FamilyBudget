export function formatMoney(amount: string | number, currency: string, locale: string = navigator.language): string {
  const value = typeof amount === 'string' ? Number(amount) : amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(value)
}

export function currencySymbol(currency: string, locale: string = navigator.language): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currency
}
