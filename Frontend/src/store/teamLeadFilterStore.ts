import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TeamLeadFilterStore {
  selectedTeamId: number | null
  setSelectedTeamId: (teamId: number | null) => void
  clearFilters: () => void
}

export const useTeamLeadFilterStore = create<TeamLeadFilterStore>()(
  persist(
    (set) => ({
      selectedTeamId: null,
      setSelectedTeamId: (teamId) => set({ selectedTeamId: teamId }),
      clearFilters: () => set({ selectedTeamId: null }),
    }),
    {
      name: 'teamlead-filter-storage',
    }
  )
)
