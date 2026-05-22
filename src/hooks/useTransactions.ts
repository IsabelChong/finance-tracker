import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, transactionsCol } from '../lib/firebase'
import { Transaction } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { isSameMonth } from '../lib/utils'

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, transactionsCol(user.uid)), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)))
      setLoading(false)
    })
    return unsub
  }, [user])

  const forMonth = (month: Date) => transactions.filter(t => isSameMonth(t.date, month))

  const monthlyIncome = (month: Date) => forMonth(month).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthlyExpenses = (month: Date) => forMonth(month).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const categoryTotals = (month: Date) => {
    const expenses = forMonth(month).filter(t => t.type === 'expense')
    const map: Record<string, { amount: number; color: string; icon: string }> = {}
    for (const t of expenses) {
      if (!map[t.categoryName]) map[t.categoryName] = { amount: 0, color: t.categoryColor, icon: t.categoryIcon }
      map[t.categoryName].amount += t.amount
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount)
  }

  return { transactions, loading, forMonth, monthlyIncome, monthlyExpenses, categoryTotals }
}
