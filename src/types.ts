import { Timestamp } from 'firebase/firestore'

export interface Account {
  id: string
  name: string
  type: 'savings' | 'checking' | 'credit'
  institution: string
  balance: number
  currency: string
  colorHex: string
  createdAt: Timestamp
}

export interface AccountBucket {
  id: string
  name: string
  allocatedAmount: number
  accountId: string
  wantId?: string
  isEmergencyFund: boolean
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
  lastUpdated: Timestamp
  createdAt: Timestamp
}

export interface Want {
  id: string
  name: string
  category: 'needs' | 'dream' | 'vacation'
  state: 'saving' | 'readyToBuy'
  targetAmount: number
  targetDate?: Timestamp
  bucketId?: string
  notes: string
  createdAt: Timestamp
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
  targetDate?: Timestamp
  notes: string
  createdAt: Timestamp
}

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Food & Dining',    icon: '🍽️', colorHex: '#FF6B35', type: 'expense', sortOrder: 0,  isDefault: true },
  { name: 'Groceries',        icon: '🛒', colorHex: '#FF9F1C', type: 'expense', sortOrder: 1,  isDefault: true },
  { name: 'Coffee',           icon: '☕', colorHex: '#A0522D', type: 'expense', sortOrder: 2,  isDefault: true },
  { name: 'Transport',        icon: '🚗', colorHex: '#4ECDC4', type: 'expense', sortOrder: 3,  isDefault: true },
  { name: 'Shopping',         icon: '🛍️', colorHex: '#C084FC', type: 'expense', sortOrder: 4,  isDefault: true },
  { name: 'Tech Products',    icon: '💻', colorHex: '#6366F1', type: 'expense', sortOrder: 5,  isDefault: true },
  { name: 'Beauty & Skincare',icon: '✨', colorHex: '#F472B6', type: 'expense', sortOrder: 6,  isDefault: true },
  { name: 'Gifts',            icon: '🎁', colorHex: '#F43F5E', type: 'expense', sortOrder: 7,  isDefault: true },
  { name: 'Entertainment',    icon: '🎬', colorHex: '#0EA5E9', type: 'expense', sortOrder: 8,  isDefault: true },
  { name: 'Travel',           icon: '✈️', colorHex: '#14B8A6', type: 'expense', sortOrder: 9,  isDefault: true },
  { name: 'Healthcare',       icon: '🏥', colorHex: '#EF4444', type: 'expense', sortOrder: 10, isDefault: true },
  { name: 'Utilities',        icon: '⚡', colorHex: '#EAB308', type: 'expense', sortOrder: 11, isDefault: true },
  { name: 'Education',        icon: '📚', colorHex: '#8B5CF6', type: 'expense', sortOrder: 12, isDefault: true },
  { name: 'Subscriptions',    icon: '🔄', colorHex: '#6B7280', type: 'expense', sortOrder: 13, isDefault: true },
  { name: 'Investments',      icon: '📈', colorHex: '#22C55E', type: 'expense', sortOrder: 14, isDefault: true },
  { name: 'Other',            icon: '💸', colorHex: '#9CA3AF', type: 'expense', sortOrder: 15, isDefault: true },
]

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Salary',    icon: '💼', colorHex: '#22C55E', type: 'income', sortOrder: 16, isDefault: true },
  { name: 'Freelance', icon: '🧑‍💻', colorHex: '#10B981', type: 'income', sortOrder: 17, isDefault: true },
]
