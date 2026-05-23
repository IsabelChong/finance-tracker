import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider, categoriesCol } from '../lib/firebase'
import { Category, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

async function seedCategories(uid: string) {
  const ref = collection(db, categoriesCol(uid))
  const snapshot = await getDocs(ref)

  if (snapshot.empty) {
    const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES]
    await Promise.all(all.map(cat => addDoc(ref, { ...cat, createdAt: serverTimestamp() })))
    return
  }

  // Sync both income and expense categories to match current defaults
  const existing = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))

  for (const defaults of [DEFAULT_INCOME_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES]) {
    const type = defaults[0].type
    const existingOfType = existing.filter(c => c.type === type)
    const defaultNames = new Set(defaults.map(c => c.name))
    const existingNames = new Set(existingOfType.map(c => c.name))
    await Promise.all([
      ...existingOfType.filter(c => !defaultNames.has(c.name)).map(c => deleteDoc(doc(ref, c.id))),
      ...defaults.filter(c => !existingNames.has(c.name)).map(c => addDoc(ref, { ...c, createdAt: serverTimestamp() })),
    ])
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      try {
        if (u) await seedCategories(u.uid)
      } catch (e) {
        console.error('seedCategories failed:', e)
      } finally {
        setLoading(false)
      }
    })
    return unsub
  }, [])

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
