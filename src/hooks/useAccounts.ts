import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, writeBatch } from 'firebase/firestore'
import { db, accountsCol, bucketsCol, transactionsCol } from '../lib/firebase'
import { Account, AccountBucket } from '../types'
import { useAuth } from '../contexts/AuthContext'

export function useAccounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [buckets, setBuckets] = useState<AccountBucket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const unsub1 = onSnapshot(query(collection(db, accountsCol(user.uid)), orderBy('createdAt', 'asc')), snap => {
      setAccounts(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Account))
          .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity))
      )
      setLoading(false)
    })
    const unsub2 = onSnapshot(query(collection(db, bucketsCol(user.uid)), orderBy('createdAt', 'asc')), snap => {
      setBuckets(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as AccountBucket))
          .sort((a, b) => {
            if (a.isEmergencyFund && !b.isEmergencyFund) return -1
            if (!a.isEmergencyFund && b.isEmergencyFund) return 1
            return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity)
          })
      )
    })
    return () => { unsub1(); unsub2() }
  }, [user])

  const addAccount = async (data: Omit<Account, 'id' | 'createdAt'>) => {
    if (!user) return
    await addDoc(collection(db, accountsCol(user.uid)), { ...data, createdAt: serverTimestamp() })
  }

  const updateAccount = async (id: string, data: Partial<Account>) => {
    if (!user) return
    await updateDoc(doc(db, accountsCol(user.uid), id), data as Record<string, unknown>)
  }

  const deleteAccount = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, accountsCol(user.uid), id))
  }

  const addBucket = async (data: Omit<AccountBucket, 'id' | 'createdAt'>) => {
    if (!user) return
    return await addDoc(collection(db, bucketsCol(user.uid)), { ...data, createdAt: serverTimestamp() })
  }

  const updateBucket = async (id: string, data: Partial<AccountBucket>) => {
    if (!user) return
    await updateDoc(doc(db, bucketsCol(user.uid), id), data as Record<string, unknown>)
  }

  const deleteBucket = async (id: string) => {
    if (!user) return
    await deleteDoc(doc(db, bucketsCol(user.uid), id))
  }

  // --- balance delta helpers ---
  // Credit balance = amount owed. Spending increases it; payments decrease it.
  // Regular balance = money held. Income increases it; expenses decrease it.
  // "from" role: the account being charged / paying out
  // "to" role: the account receiving a transfer
  const fromDelta = (acc: Account, type: 'income' | 'expense' | 'transfer', amount: number): number => {
    if (type === 'transfer') return acc.type === 'credit' ? amount  : -amount
    // credit: expense=+debt, income=refund=-debt; regular: income=+, expense=-
    return acc.type === 'credit'
      ? (type === 'expense' ? amount : -amount)
      : (type === 'income'  ? amount : -amount)
  }
  const toDelta = (acc: Account, amount: number): number =>
    acc.type === 'credit' ? -amount : amount  // payment reduces credit debt; transfer fills regular

  // Add a transaction and atomically update account balance(s)
  const addTransaction = async (tx: {
    date: Date; amount: number; type: 'income' | 'expense' | 'transfer'
    categoryName: string; categoryIcon: string; categoryColor: string
    accountId: string; accountName: string
    toAccountId?: string; toAccountName?: string
    payee: string; notes: string
  }) => {
    if (!user) return
    const batch = writeBatch(db)
    const txRef = doc(collection(db, transactionsCol(user.uid)))
    const txData: Record<string, unknown> = {
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      categoryName: tx.categoryName,
      categoryIcon: tx.categoryIcon,
      categoryColor: tx.categoryColor,
      accountId: tx.accountId,
      accountName: tx.accountName,
      payee: tx.payee,
      notes: tx.notes,
      createdAt: serverTimestamp(),
    }
    if (tx.toAccountId)   txData.toAccountId   = tx.toAccountId
    if (tx.toAccountName) txData.toAccountName = tx.toAccountName
    batch.set(txRef, txData)

    const fromAcc = accounts.find(a => a.id === tx.accountId)
    if (fromAcc) {
      batch.update(doc(db, accountsCol(user.uid), tx.accountId), {
        balance: fromAcc.balance + fromDelta(fromAcc, tx.type, tx.amount),
      })
    }

    if (tx.type === 'transfer' && tx.toAccountId) {
      const toAcc = accounts.find(a => a.id === tx.toAccountId)
      if (toAcc) {
        batch.update(doc(db, accountsCol(user.uid), tx.toAccountId), {
          balance: toAcc.balance + toDelta(toAcc, tx.amount),
        })
      }
    }

    await batch.commit()
    return txRef.id
  }

  const updateTransaction = async (
    txId: string,
    oldTx: { amount: number; type: string; accountId: string; toAccountId?: string },
    newTx: Parameters<typeof addTransaction>[0]
  ) => {
    if (!user) return
    const batch = writeBatch(db)

    const txData: Record<string, unknown> = {
      date: newTx.date, amount: newTx.amount, type: newTx.type,
      categoryName: newTx.categoryName, categoryIcon: newTx.categoryIcon, categoryColor: newTx.categoryColor,
      accountId: newTx.accountId, accountName: newTx.accountName,
      payee: newTx.payee, notes: newTx.notes,
    }
    if (newTx.toAccountId)   txData.toAccountId   = newTx.toAccountId
    if (newTx.toAccountName) txData.toAccountName = newTx.toAccountName
    batch.update(doc(db, transactionsCol(user.uid), txId), txData)

    const deltas: Record<string, number> = {}
    const apply = (accId: string, delta: number) => { deltas[accId] = (deltas[accId] ?? 0) + delta }

    // Reverse old transaction
    const oldFromAcc = accounts.find(a => a.id === oldTx.accountId)
    if (oldFromAcc) apply(oldTx.accountId, -fromDelta(oldFromAcc, oldTx.type as any, oldTx.amount))
    if (oldTx.type === 'transfer' && oldTx.toAccountId) {
      const oldToAcc = accounts.find(a => a.id === oldTx.toAccountId)
      if (oldToAcc) apply(oldTx.toAccountId, -toDelta(oldToAcc, oldTx.amount))
    }

    // Apply new transaction
    const newFromAcc = accounts.find(a => a.id === newTx.accountId)
    if (newFromAcc) apply(newTx.accountId, fromDelta(newFromAcc, newTx.type, newTx.amount))
    if (newTx.type === 'transfer' && newTx.toAccountId) {
      const newToAcc = accounts.find(a => a.id === newTx.toAccountId)
      if (newToAcc) apply(newTx.toAccountId, toDelta(newToAcc, newTx.amount))
    }

    for (const [accId, delta] of Object.entries(deltas)) {
      if (delta === 0) continue
      const acc = accounts.find(a => a.id === accId)
      if (acc) batch.update(doc(db, accountsCol(user.uid), accId), { balance: acc.balance + delta })
    }

    await batch.commit()
  }

  const deleteTransaction = async (txId: string, tx: { amount: number; type: string; accountId: string; toAccountId?: string }) => {
    if (!user) return
    const batch = writeBatch(db)
    batch.delete(doc(db, transactionsCol(user.uid), txId))

    const fromAcc = accounts.find(a => a.id === tx.accountId)
    if (fromAcc) {
      batch.update(doc(db, accountsCol(user.uid), tx.accountId), {
        balance: fromAcc.balance - fromDelta(fromAcc, tx.type as any, tx.amount),
      })
    }
    if (tx.type === 'transfer' && tx.toAccountId) {
      const toAcc = accounts.find(a => a.id === tx.toAccountId)
      if (toAcc) {
        batch.update(doc(db, accountsCol(user.uid), tx.toAccountId), {
          balance: toAcc.balance - toDelta(toAcc, tx.amount),
        })
      }
    }
    await batch.commit()
  }

  const reorderAccounts = async (orderedIds: string[]) => {
    if (!user) return
    const batch = writeBatch(db)
    orderedIds.forEach((id, i) => batch.update(doc(db, accountsCol(user.uid), id), { sortOrder: i }))
    await batch.commit()
  }

  const reorderBuckets = async (orderedIds: string[]) => {
    if (!user) return
    const batch = writeBatch(db)
    orderedIds.forEach((id, i) => batch.update(doc(db, bucketsCol(user.uid), id), { sortOrder: i }))
    await batch.commit()
  }

  const bucketsForAccount = (accountId: string) => buckets.filter(b => b.accountId === accountId)
  const allocatedForAccount = (accountId: string) => bucketsForAccount(accountId).reduce((s, b) => s + b.allocatedAmount, 0)

  return { accounts, buckets, loading, addAccount, updateAccount, deleteAccount, reorderAccounts, addBucket, updateBucket, deleteBucket, reorderBuckets, addTransaction, updateTransaction, deleteTransaction, bucketsForAccount, allocatedForAccount }
}
