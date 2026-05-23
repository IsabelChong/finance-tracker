import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { formatCurrency, formatDate, monthLabel, addMonths, toDate } from '../lib/utils'
import { Transaction } from '../types'
import AddTransactionModal from './modals/AddTransactionModal'

export default function TransactionsPage() {
  const [month, setMonth] = useState(new Date())
  const [tab, setTab] = useState<'list' | 'chart'>('list')
  const [showAdd, setShowAdd] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const { accounts, addTransaction, updateTransaction, deleteTransaction } = useAccounts()
  const { transactions, forMonth, monthlyIncome, monthlyExpenses, categoryTotals } = useTransactions()
  const { expenseCategories, incomeCategories } = useCategories()

  const monthTxs = forMonth(month)
  const income = monthlyIncome(month)
  const expenses = monthlyExpenses(month)
  const chartData = categoryTotals(month)

  // Group by day
  const grouped: { date: Date; txs: Transaction[] }[] = []
  const seen = new Set<string>()
  for (const tx of monthTxs) {
    const d = toDate(tx.date)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!seen.has(key)) {
      seen.add(key)
      grouped.push({ date: d, txs: monthTxs.filter(t => {
        const td = toDate(t.date)
        return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate()
      })})
    }
  }

  const isCurrentMonth = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear()

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold">Transactions</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between bg-slate-900 rounded-xl px-4 py-3 border border-slate-800">
        <button onClick={() => setMonth(addMonths(month, -1))} className="text-slate-400 hover:text-white transition-colors p-1">
          <ChevronLeft size={20} />
        </button>
        <span className="font-semibold">{monthLabel(month)}</span>
        <button onClick={() => setMonth(addMonths(month, 1))} disabled={isCurrentMonth}
          className="text-slate-400 hover:text-white disabled:opacity-30 transition-colors p-1">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-0.5">Income</p>
          <p className="font-bold text-green-400">{formatCurrency(income)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-0.5">Expenses</p>
          <p className="font-bold text-red-400">{formatCurrency(expenses)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className="text-slate-400 text-xs mb-0.5">Net</p>
          <p className={`font-bold ${income - expenses >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>{formatCurrency(income - expenses)}</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(['list', 'chart'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {t === 'list' ? 'Transactions' : 'Spending Chart'}
          </button>
        ))}
      </div>

      {/* List view */}
      {tab === 'list' && (
        <div className="space-y-4">
          {grouped.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
              No transactions for {monthLabel(month)}
            </div>
          ) : (
            grouped.map(({ date, txs }) => (
              <div key={date.toISOString()}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  {formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
                  {txs.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 group">
                      <span className="text-xl w-9 h-9 flex items-center justify-center bg-slate-800 rounded-full shrink-0">{tx.categoryIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.payee || tx.categoryName}</p>
                        <p className="text-xs text-slate-500">
                          {tx.categoryName} · {tx.accountName}
                          {tx.type === 'transfer' && tx.toAccountName && ` → ${tx.toAccountName}`}
                        </p>
                        {tx.notes && <p className="text-xs text-slate-600 truncate">{tx.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-green-400' : 'text-slate-300'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <button
                          onClick={() => setEditTx(tx)}
                          className="text-slate-600 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100 lg:block hidden p-1">
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => deleteTransaction(tx.id, { amount: tx.amount, type: tx.type, accountId: tx.accountId, toAccountId: tx.toAccountId })}
                          className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 lg:block hidden p-1">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Chart view */}
      {tab === 'chart' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          {chartData.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No expenses to chart</p>
          ) : (
            <>
              <h3 className="font-semibold text-sm text-slate-300 mb-4">Spending by Category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={chartData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={110} paddingAngle={2}>
                    {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10 }} />
                  <Legend formatter={v => <span className="text-xs text-slate-300">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {chartData.map(item => (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-base">{item.icon}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-300">{item.name}</span>
                        <span className="font-semibold">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (item.amount / expenses) * 100)}%`, background: item.color }} />
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 w-10 text-right">{((item.amount / expenses) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {showAdd && (
        <AddTransactionModal
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onSave={addTransaction}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editTx && (
        <AddTransactionModal
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          initialTx={editTx}
          onUpdate={updateTransaction}
          onClose={() => setEditTx(null)}
        />
      )}
    </div>
  )
}
