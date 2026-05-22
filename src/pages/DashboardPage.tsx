import { useState } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useInvestments } from '../hooks/useInvestments'
import { useCategories } from '../hooks/useCategories'
import { formatCurrency, formatDate } from '../lib/utils'
import AddTransactionModal from './modals/AddTransactionModal'

export default function DashboardPage() {
  const { accounts, allocatedForAccount, addTransaction } = useAccounts()
  const { transactions, monthlyIncome, monthlyExpenses } = useTransactions()
  const { totalValue } = useInvestments()
  const { expenseCategories, incomeCategories } = useCategories()
  const [showAdd, setShowAdd] = useState(false)

  const now = new Date()
  const totalAssets = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + a.balance, 0)
  const netWorth = totalAssets - totalLiabilities + totalValue
  const income = monthlyIncome(now)
  const expenses = monthlyExpenses(now)
  const recent = transactions.slice(0, 6)

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Net worth */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6">
        <p className="text-blue-200 text-sm font-medium">Net Worth</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(netWorth)}</p>
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <p className="text-blue-200">Assets</p>
            <p className="font-semibold text-green-300">{formatCurrency(totalAssets)}</p>
          </div>
          <div>
            <p className="text-blue-200">Debt</p>
            <p className="font-semibold text-red-300">{formatCurrency(totalLiabilities)}</p>
          </div>
          <div>
            <p className="text-blue-200">Invested</p>
            <p className="font-semibold text-purple-300">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      </div>

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-green-400 text-xs font-medium mb-1">
            <TrendingDown size={14} /> Income
          </div>
          <p className="font-bold text-base">{formatCurrency(income)}</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
            <TrendingUp size={14} /> Expenses
          </div>
          <p className="font-bold text-base">{formatCurrency(expenses)}</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-medium mb-1">
            <Wallet size={14} /> Saved
          </div>
          <p className={`font-bold text-base ${income - expenses >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
            {formatCurrency(income - expenses)}
          </p>
        </div>
      </div>

      {/* Accounts scroll */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Accounts</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {accounts.map(acc => {
              const allocated = allocatedForAccount(acc.id)
              return (
                <div key={acc.id} className="shrink-0 w-44 bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: acc.colorHex }} />
                    <span className="text-xs text-slate-400">{acc.type}</span>
                  </div>
                  <p className="text-sm font-semibold truncate">{acc.name}</p>
                  <p className={`text-xl font-bold mt-1 ${acc.type === 'credit' ? 'text-red-400' : ''}`}>
                    {formatCurrency(acc.balance)}
                  </p>
                  {acc.type !== 'credit' && allocated > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">{formatCurrency(allocated)} allocated</p>
                  )}
                  {acc.type === 'credit' && <p className="text-xs text-red-400 mt-0.5">owed</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Recent</h2>
        {recent.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-8 text-center text-slate-500 border border-slate-800">
            No transactions yet. Tap + to add one.
          </div>
        ) : (
          <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
            {recent.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl w-9 h-9 flex items-center justify-center bg-slate-800 rounded-full shrink-0">
                  {tx.categoryIcon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.payee || tx.categoryName}</p>
                  <p className="text-xs text-slate-500">{tx.accountName} · {formatDate(tx.date, { day: 'numeric', month: 'short' })}</p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-green-400' : 'text-slate-300'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddTransactionModal
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onSave={addTransaction}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
