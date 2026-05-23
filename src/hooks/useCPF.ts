import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db, cpfDoc, housingGoalsCol } from '../lib/firebase'
import { CPFData, HousingGoal } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function useCPF() {
  const { user } = useAuth()
  const [cpf, setCpf] = useState<CPFData | null>(null)
  const [housingGoals, setHousingGoals] = useState<HousingGoal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsubCPF = onSnapshot(doc(db, cpfDoc(user.uid)), snap => {
      setCpf(snap.exists() ? (snap.data() as CPFData) : null)
      setLoading(false)
    })
    const unsubGoals = onSnapshot(
      query(collection(db, housingGoalsCol(user.uid)), orderBy('createdAt', 'asc')),
      snap => setHousingGoals(snap.docs.map(d => ({ id: d.id, ...d.data() } as HousingGoal)))
    )
    return () => { unsubCPF(); unsubGoals() }
  }, [user])

  const updateCPFBalance = async (account: 'ordinary' | 'special' | 'medisave', amount: number) => {
    if (!user) return
    await setDoc(doc(db, cpfDoc(user.uid)), {
      [`${account}Balance`]: amount,
      [`${account}LastUpdated`]: serverTimestamp(),
    }, { merge: true })
  }

  const addHousingGoal = async (data: Omit<HousingGoal, 'id' | 'createdAt'>) => {
    if (!user) return
    await addDoc(collection(db, housingGoalsCol(user.uid)), { ...data, createdAt: serverTimestamp() })
  }

  const updateHousingGoal = async (id: string, data: Partial<Omit<HousingGoal, 'id' | 'createdAt'>>) => {
    if (!user) return
    await updateDoc(doc(db, housingGoalsCol(user.uid), id), data as Record<string, unknown>)
  }

  const deleteHousingGoal = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, housingGoalsCol(user.uid), id))
  }

  const totalCPF = (cpf?.ordinaryBalance ?? 0) + (cpf?.specialBalance ?? 0) + (cpf?.medisaveBalance ?? 0)

  return { cpf, loading, housingGoals, totalCPF, updateCPFBalance, addHousingGoal, updateHousingGoal, deleteHousingGoal }
}
