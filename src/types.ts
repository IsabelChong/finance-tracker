import { Timestamp } from 'firebase/firestore'

export interface Account {
  id: string
  name: string
  type: 'savings' | 'cash' | 'investment' | 'credit'
  institution: string
  balance: number
  currency: string
  colorHex: string
  sortOrder?: number
  createdAt: Timestamp
}

export interface AccountBucket {
  id: string
  name: string
  allocatedAmount: number
  accountId: string
  wantId?: string
  isEmergencyFund: boolean
  sortOrder?: number
  createdAt: Timestamp
}

export interface Transaction {
  id: string
  date: Timestamp
  amount: number
  type: 'income' | 'expense' | 'transfer'
  categoryName: string
  categoryIcon: string
  categoryColor: string
  accountId: string
  accountName: string
  toAccountId?: string
  toAccountName?: string
  payee: string
  notes: string
  createdAt: Timestamp
}

export interface Category {
  id: string
  name: string
  icon: string
  colorHex: string
  type: 'income' | 'expense'
  sortOrder: number
  isDefault: boolean
}

export interface Investment {
  id: string
  ticker: string
  name: string
  shares: number
  purchasePrice: number
  currentPrice: number
  purchaseDate: Timestamp
  broker: string
  currency: string
  notes: string
  sortOrder?: number
  fundedBy?: 'cash' | 'cpf-oa'
  lastUpdated: Timestamp
  createdAt: Timestamp
}

export interface Want {
  id: string
  name: string
  category: 'needs' | 'dream' | 'vacation'
  state: 'saving' | 'readyToBuy' | 'purchased'
  targetAmount: number
  targetDate?: Timestamp
  bucketId?: string
  notes: string
  createdAt: Timestamp
  purchasedAmount?: number
  purchasedAt?: Timestamp
  purchaseTransactionId?: string
  purchaseAccountId?: string
}

export interface CPFData {
  ordinaryBalance: number
  ordinaryLastUpdated?: Timestamp
  specialBalance: number
  specialLastUpdated?: Timestamp
  medisaveBalance: number
  medisaveLastUpdated?: Timestamp
}

export interface HousingGoal {
  id: string
  name: string
  targetPrice: number
  cpfOAPlanned: number
  cashDownPayment: number
  // HDB grants — all credited to CPF OA
  grantEHG?: number           // Enhanced CPF Housing Grant (up to $120,000)
  grantCPFHousing?: number    // CPF Housing Grant / Family Grant (up to $80,000)
  grantProximity?: number     // Proximity Housing Grant (up to $30,000)
  grantStepUp?: number        // Step-Up CPF Housing Grant ($15,000)
  targetDate?: Timestamp
  notes: string
  createdAt: Timestamp
}

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Drinks',             icon: '🥤', colorHex: '#0EA5E9', type: 'expense', sortOrder: 0,  isDefault: true },
  { name: 'Beauty and Skincare',icon: '✨', colorHex: '#F472B6', type: 'expense', sortOrder: 1,  isDefault: true },
  { name: 'Mobile Bill',        icon: '📱', colorHex: '#64748B', type: 'expense', sortOrder: 2,  isDefault: true },
  { name: 'Gifts',              icon: '🎁', colorHex: '#F43F5E', type: 'expense', sortOrder: 3,  isDefault: true },
  { name: 'Education',          icon: '📚', colorHex: '#8B5CF6', type: 'expense', sortOrder: 4,  isDefault: true },
  { name: 'Investment',         icon: '📈', colorHex: '#22C55E', type: 'expense', sortOrder: 5,  isDefault: true },
  { name: 'Mutual Funds',       icon: '💹', colorHex: '#10B981', type: 'expense', sortOrder: 6,  isDefault: true },
  { name: 'Subscription',       icon: '🔄', colorHex: '#6366F1', type: 'expense', sortOrder: 7,  isDefault: true },
  { name: 'Gym',                icon: '🏋️', colorHex: '#F97316', type: 'expense', sortOrder: 8,  isDefault: true },
  { name: 'Others',             icon: '💸', colorHex: '#9CA3AF', type: 'expense', sortOrder: 99, isDefault: true },
]

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Salary',    icon: '💼', colorHex: '#22C55E', type: 'income', sortOrder: 16, isDefault: true },
  { name: 'Freelance', icon: '🧑‍💻', colorHex: '#10B981', type: 'income', sortOrder: 17, isDefault: true },
  { name: 'Cashback',  icon: '💳', colorHex: '#F59E0B', type: 'income', sortOrder: 18, isDefault: true },
]
