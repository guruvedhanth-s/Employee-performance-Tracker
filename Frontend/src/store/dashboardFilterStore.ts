import { create } from 'zustand'

const START_YEAR = 2026
const START_MONTH = 1 // January

// Helper to get month options (restricted to current month and past months)
export const getMonthOptions = (selectedYear: string) => {
  const allMonths = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ]
  
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  const year = parseInt(selectedYear)
  
  // If selected year is current year, only show months up to current month
  if (year === currentYear) {
    return allMonths.filter(m => parseInt(m.value) <= currentMonth)
  }
  
  // If selected year is the start year (2026), show from start month onwards
  if (year === START_YEAR) {
    return allMonths.filter(m => parseInt(m.value) >= START_MONTH)
  }
  
  // If selected year is in the past (but after start year), show all months
  if (year < currentYear && year > START_YEAR) {
    return allMonths
  }
  
  // If selected year is before start year, return empty (shouldn't happen)
  if (year < START_YEAR) {
    return []
  }
  
  // Future year - shouldn't happen but return empty
  return []
}

// Helper to get year options (from START_YEAR to current year only)
export const getYearOptions = () => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = START_YEAR; year <= currentYear; year++) {
    years.push({
      value: String(year),
      label: String(year),
    })
  }
  return years
}

interface DashboardFilterStore {
  filterMonth: string
  filterYear: string
  filterPeriod: 'current' | 'previous' | 'custom'
  filterOrgId: string | null  // null means "All Organizations" for superadmin
  
  // Actions
  setFilterMonth: (month: string) => void
  setFilterYear: (year: string) => void
  setFilterPeriod: (period: 'current' | 'previous' | 'custom') => void
  setFilterOrgId: (orgId: string | null) => void
  setCurrentMonth: () => void
  setPreviousMonth: () => void
}

const currentDate = new Date()
const currentYear = currentDate.getFullYear()
const currentMonth = currentDate.getMonth() + 1

// Default to current month/year (but not before START_YEAR/START_MONTH)
const defaultYear = Math.max(currentYear, START_YEAR)
const defaultMonth = defaultYear === START_YEAR && currentYear === START_YEAR 
  ? Math.max(currentMonth, START_MONTH) 
  : (defaultYear > currentYear ? START_MONTH : currentMonth)

export const useDashboardFilterStore = create<DashboardFilterStore>((set) => ({
  filterMonth: String(defaultMonth),
  filterYear: String(defaultYear),
  filterPeriod: 'current',
  filterOrgId: null,  // Default to all orgs for superadmin
  
  setFilterMonth: (month: string) => set({ filterMonth: month, filterPeriod: 'custom' }),
  
  setFilterYear: (year: string) => set((state) => {
    const yearNum = parseInt(year)
    const now = new Date()
    const currYear = now.getFullYear()
    const currMonth = now.getMonth() + 1
    
    // If changing to current year, ensure month doesn't exceed current month
    let newMonth = state.filterMonth
    if (yearNum === currYear && parseInt(state.filterMonth) > currMonth) {
      newMonth = String(currMonth)
    }
    // If changing to start year, ensure month is not before start month
    if (yearNum === START_YEAR && parseInt(state.filterMonth) < START_MONTH) {
      newMonth = String(START_MONTH)
    }
    
    return { filterYear: year, filterMonth: newMonth, filterPeriod: 'custom' }
  }),
  
  setFilterPeriod: (period: 'current' | 'previous' | 'custom') => set({ filterPeriod: period }),
  
  setFilterOrgId: (orgId: string | null) => set({ filterOrgId: orgId }),
  
  setCurrentMonth: () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    set({
      filterMonth: String(month),
      filterYear: String(year),
      filterPeriod: 'current',
    })
  },
  
  setPreviousMonth: () => {
    const now = new Date()
    const currYear = now.getFullYear()
    const currMonth = now.getMonth() + 1
    
    let prevMonth = currMonth - 1
    let prevYear = currYear
    
    if (prevMonth < 1) {
      prevMonth = 12
      prevYear = currYear - 1
    }
    
    // Don't go below start year/month
    if (prevYear < START_YEAR || (prevYear === START_YEAR && prevMonth < START_MONTH)) {
      prevYear = START_YEAR
      prevMonth = START_MONTH
    }
    
    set({
      filterMonth: String(prevMonth),
      filterYear: String(prevYear),
      filterPeriod: 'previous',
    })
  },
}))
