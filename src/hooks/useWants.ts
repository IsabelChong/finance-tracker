import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore'
import { db, wantsCol } from '../lib/firebase'
import { Want } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function useWants() {
  const { user } = useAuth()
  const [wants, setWants] = useState<Want[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, wantsCol(user.uid)), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setWants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Want)))
      setLoading(false)
    })
  }, [user])

  const addWant = async (data: Omit<Want, 'id' | 'createdAt'>) => {
    if (!user) return
    const payload = Object.fromEntries(Object.entries({ ...data, createdAt: serverTimestamp() }).filter(([, v]) => v !== undefined))
    return await addDoc(collection(db, wantsCol(user.uid)), payload)
  }

  const updateWant = async (id: string, data: Partial<Want>) => {
    if (!user) return
    const payload = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    await updateDoc(doc(db, wantsCol(user.uid), id), payload as Record<string, unknown>)
  }

  const deleteWant = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, wantsCol(user.uid), id))
  }

  return { wants, loading, addWant, updateWant, deleteWant }
}
