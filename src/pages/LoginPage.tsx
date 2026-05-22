import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">💰</div>
          <h1 className="text-3xl font-bold text-white">Finance Tracker</h1>
          <p className="text-slate-400 mt-2">Your all-in-one personal finance hub</p>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 space-y-4">
          <p className="text-slate-300 text-sm text-center">Sign in to access your data across all your devices</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 font-semibold py-3 px-4 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.5-.4-3.5z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2 14.3-5.4l-6.6-5.5C29.7 35 27 36 24 36c-5.2 0-9.6-3.1-11.3-7.5L6 34c3.3 6.4 9.9 10 18 10z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.5C41.4 35.7 44 30.3 44 24c0-1.2-.1-2.5-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="text-slate-500 text-xs text-center mt-6">
          Your data is private and stored securely in your Firebase project
        </p>
      </div>
    </div>
  )
}
