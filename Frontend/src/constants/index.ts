export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },
  ORGANIZATIONS: {
    LIST: '/organizations',
    CREATE: '/organizations',
    UPDATE: '/organizations/:id',
    DELETE: '/organizations/:id',
    GET: '/organizations/:id',
  },
  USERS: {
    LIST: '/users',
    CREATE: '/users',
    UPDATE: '/users/:id',
    DELETE: '/users/:id',
    GET: '/users/:id',
  },
  TEAMS: {
    LIST: '/teams',
    CREATE: '/teams',
    UPDATE: '/teams/:id',
    DELETE: '/teams/:id',
    GET: '/teams/:id',
  },
  ORDERS: {
    LIST: '/orders',
    CREATE: '/orders',
    UPDATE: '/orders/:id',
    DELETE: '/orders/:id',
    GET: '/orders/:id',
  },
  DASHBOARD: {
    ADMIN: '/dashboard/admin',
    TEAMLEAD: '/dashboard/teamlead',
    EMPLOYEE: '/dashboard/employee',
  },
  BILLING: {
    RATES: '/billing/rates',
    INVOICE: '/billing/invoice',
    REPORT: '/billing/report',
  },
}

export const TRANSACTION_TYPES = {
  SALE_CASH: 'Sale/Cash',
  SALE_W_MORTGAGE: 'Sale w/Mortgage',
  EQUITY_LOAN: 'Equity Loan',
  REFINANCE: 'Refinance',
  CONSTRUCTION_LOAN: 'Construction Loan',
  SEARCH_PACKAGE: 'Search Package',
  SECOND_LOAN: 'Second Loan',
} as const

export const PROCESS_TYPES = {
  STEP1: 'Step1',
  STEP2: 'Step2',
  STEP1_AND_STEP2: 'Step1 & Step2',
  SINGLE_SEAT: 'Single Seat',
} as const

export const ORDER_STATUS = {
  COMPLETED: 'Completed',
  ON_HOLD: 'On-hold',
  BP: 'BP',
  RTI: 'RTI',
} as const

export const DIVISION_TYPES = {
  DIRECT: 'Direct',
  AGENCY: 'Agency',
} as const

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
] as const

export const PRODUCT_TYPES = [
  'Full Search',
  'Update',
  'Current Owner',
  'Date Down',
  '2 Owner',
  'O&E',
  'Municipal Lien Search',
  'Lot Book Report',
  'Bring Down',
  'Water Right',
] as const

export const USER_ROLES = {
  ADMIN: 'admin',
  TEAMLEAD: 'teamlead',
  EMPLOYEE: 'employee',
} as const
