export const SUPPORTED_LOCALES = [
  { code: '', label: 'Auto (browser)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de-DE', label: 'German' },
  { code: 'fr-FR', label: 'French' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'ru-RU', label: 'Russian' },
]

export function spaceLocale(space: { locale?: string }): string {
  return space.locale || navigator.language
}
