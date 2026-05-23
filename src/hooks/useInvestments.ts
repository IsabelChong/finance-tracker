import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, writeBatch } from 'firebase/firestore'
import { db, investmentsCol } from '../lib/firebase'
import { Investment } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useFXRates } from '../contexts/FXRatesContext'

export function useInvestments() {
  const { user } = useAuth()
  const { toSGD } = useFXRates()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, investmentsCol(user.uid)), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment)))
      setLoading(false)
    })
  }, [user])

  const addInvestment = async (data: Omit<Investment, 'id' | 'createdAt' | 'lastUpdated'>) => {
    if (!user) return
    await addDoc(collection(db, investmentsCol(user.uid)), { ...data, lastUpdated: serverTimestamp(), createdAt: serverTimestamp() })
  }

  const updateInvestment = async (id: string, data: Partial<Investment>) => {
    if (!user) return
    await updateDoc(doc(db, investmentsCol(user.uid), id), { ...data as Record<string, unknown>, lastUpdated: serverTimestamp() })
  }

  const deleteInvestment = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, investmentsCol(user.uid), id))
  }

  // Update currentPrice for every lot sharing the same ticker in one batch
  const updatePricesByTicker = async (prices: Record<string, number>) => {
    if (!user) return
    const batch = writeBatch(db)
    for (const inv of investments) {
      if (prices[inv.ticker] !== undefined) {
        batch.update(doc(db, investmentsCol(user.uid), inv.id), { currentPrice: prices[inv.ticker], lastUpdated: serverTimestamp() })
      }
    }
    await batch.commit()
  }

  const reorderInvestmentGroups = async (orderedTickers: string[]) => {
    if (!user) return
    const batch = writeBatch(db)
    orderedTickers.forEach((ticker, i) => {
      for (const inv of investments.filter(l => l.ticker === ticker)) {
        batch.update(doc(db, investmentsCol(user.uid), inv.id), { sortOrder: i * 10 })
      }
    })
    await batch.commit()
  }

  const totalCostSGD  = investments.reduce((s, i) => s + toSGD(i.shares * i.purchasePrice, i.currency), 0)
  const totalValueSGD = investments.reduce((s, i) => s + toSGD(i.shares * i.currentPrice,  i.currency), 0)
  const totalGainLossSGD = totalValueSGD - totalCostSGD
  const totalGainLossPct = totalCostSGD > 0 ? (totalGainLossSGD / totalCostSGD) * 100 : 0

  const cpfOaInvestments = investments.filter(i => i.fundedBy === 'cpf-oa')
  const cpfOaInvestedCostSGD  = cpfOaInvestments.reduce((s, i) => s + toSGD(i.shares * i.purchasePrice, i.currency), 0)
  const cpfOaCurrentValueSGD  = cpfOaInvestments.reduce((s, i) => s + toSGD(i.shares * i.currentPrice,  i.currency), 0)
  const cpfOaGainLossSGD = cpfOaCurrentValueSGD - cpfOaInvestedCostSGD

  return { investments, loading, addInvestment, updateInvestment, deleteInvestment, updatePricesByTicker, reorderInvestmentGroups, totalCostSGD, totalValueSGD, totalGainLossSGD, totalGainLossPct, cpfOaInvestedCostSGD, cpfOaCurrentValueSGD, cpfOaGainLossSGD }
}
