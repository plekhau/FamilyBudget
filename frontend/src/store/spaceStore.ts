import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SpaceState {
  selectedSpaceId: number | null
  setSelectedSpaceId: (id: number | null) => void
}

export const useSpaceStore = create<SpaceState>()(
  persist(
    (set) => ({
      selectedSpaceId: null,
      setSelectedSpaceId: (id) => set({ selectedSpaceId: id }),
    }),
    { name: 'space' }
  )
)
