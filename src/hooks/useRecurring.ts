import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore'
import { db, recurringCol } from '../lib/firebase'
import { RecurringTransaction } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function useRecurring() {
  const { user } = useAuth()
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, recurringCol(user.uid)), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setRecurring(snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringTransaction)))
    })
  }, [user])

  const addRecurring = async (data: Omit<RecurringTransaction, 'id' | 'createdAt' | 'lastLoggedAt'>) => {
    if (!user) return
    await addDoc(collection(db, recurringCol(user.uid)), { ...data, createdAt: serverTimestamp() })
  }

  const updateRecurring = async (id: string, data: Partial<RecurringTransaction>) => {
    if (!user) return
    await updateDoc(doc(db, recurringCol(user.uid), id), data as Record<string, unknown>)
  }

  const deleteRecurring = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, recurringCol(user.uid), id))
  }

  return { recurring, addRecurring, updateRecurring, deleteRecurring }
}
