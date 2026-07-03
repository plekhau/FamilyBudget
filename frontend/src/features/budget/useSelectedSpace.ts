import { useSpaces, type Space } from '@/hooks/useSpaces'
import { useSpaceStore } from '@/store/spaceStore'

export function useSelectedSpace(): { space: Space | null; isLoading: boolean } {
  const { data: spaces = [], isLoading } = useSpaces()
  const selectedSpaceId = useSpaceStore((s) => s.selectedSpaceId)
  const space = spaces.find((s) => s.id === selectedSpaceId) ?? spaces[0] ?? null
  return { space, isLoading }
}
