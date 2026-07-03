export function getLastCategoryId(spaceId: number): number | null {
  const raw = localStorage.getItem(`lastCategory:${spaceId}`)
  const id = raw === null ? NaN : Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export function setLastCategoryId(spaceId: number, categoryId: number): void {
  localStorage.setItem(`lastCategory:${spaceId}`, String(categoryId))
}
