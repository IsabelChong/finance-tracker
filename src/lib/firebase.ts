import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

export const userCol = (uid: string) => `users/${uid}`
export const accountsCol = (uid: string) => `users/${uid}/accounts`
export const bucketsCol = (uid: string) => `users/${uid}/buckets`
export const transactionsCol = (uid: string) => `users/${uid}/transactions`
export const categoriesCol = (uid: string) => `users/${uid}/categories`
export const investmentsCol = (uid: string) => `users/${uid}/investments`
export const wantsCol = (uid: string) => `users/${uid}/wants`
export const cpfDoc = (uid: string) => `users/${uid}/cpf/main`
export const housingGoalsCol = (uid: string) => `users/${uid}/housingGoals`
