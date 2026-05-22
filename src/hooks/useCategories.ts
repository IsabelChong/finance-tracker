import { useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, categoriesCol } from '../lib/firebase'
import { Category } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function useCategories() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, categoriesCol(user.uid)), orderBy('sortOrder', 'asc'))
    return onSnapshot(q, snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)))
    })
  }, [user])

  return {
    categories,
    expenseCategories: categories.filter(c => c.type === 'expense'),
    incomeCategories: categories.filter(c => c.type === 'income'),
  }
}
