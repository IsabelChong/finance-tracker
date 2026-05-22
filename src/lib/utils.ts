import { Timestamp } from 'firebase/firestore'

export function formatCurrency(amount: number, currency = 'SGD'): string {
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(ts: Timestamp | Date | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!ts) return ''
  const date = ts instanceof Timestamp ? ts.toDate() : ts
  return date.toLocaleDateString('en-SG', opts ?? { day: 'numeric', month: 'short', year: 'numeric' })
}

export function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  return ts instanceof Timestamp ? ts.toDate() : ts
}

export function isSameMonth(ts: Timestamp | Date, ref: Date): boolean {
  const d = ts instanceof Timestamp ? ts.toDate() : ts
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

export function monthLabel(date: Date): string {
  return date.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
