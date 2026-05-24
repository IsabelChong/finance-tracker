import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Repeat, Check } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Timestamp } from 'firebase/firestore'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useCategories } from '../hooks/useCategories'
import { useRecurring } from '../hooks/useRecurring'
import { formatCurrency, formatDate, monthLabel, addMonths, toDate } from '../lib/utils'
import { Transaction, RecurringTransaction, Category, Account } from '../types'
import AddTransactionModal from './modals/AddTransactionModal'

const DOW_LABELS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const DOW_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function tsToDate(ts: any): Date | null {
  if (!ts) return null
  return ts?.toDate ? ts.toDate() : new Date(ts)
}

function getNextDueDate(r: RecurringTransaction): Date {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lastLogged = tsToDate(r.lastLoggedAt)

  if (r.frequency === 'monthly') {
    const dom = r.dayOfMonth ?? 1
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), dom)
    const loggedThisMonth = lastLogged && lastLogged >= startOfMonth
    if (loggedThisMonth || today < thisMonthDue)
      return new Date(today.getFullYear(), today.getMonth() + 1, dom)
    return thisMonthDue
  } else {
    const dow = r.dayOfWeek ?? 1
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay())
    const thisWeekDue = new Date(startOfWeek); thisWeekDue.setDate(startOfWeek.getDate() + dow)
    const loggedThisWeek = lastLogged && lastLogged >= startOfWeek
    if (loggedThisWeek || today < thisWeekDue) {
      const next = new Date(thisWeekDue); next.setDate(thisWeekDue.getDate() + 7); return next
    }
    return thisWeekDue
  }
}

function getDueStatus(r: RecurringTransaction): 'due' | 'upcoming' | 'logged' {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lastLogged = tsToDate(r.lastLoggedAt)
  if (r.frequency === 'monthly') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    if (lastLogged && lastLogged >= startOfMonth) return 'logged'
  } else {
    const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay())
    if (lastLogged && lastLogged >= startOfWeek) return 'logged'
  }
  const nextDue = getNextDueDate(r)
  return nextDue <= today ? 'due' : 'upcoming'
}

function dueBadge(r: RecurringTransaction) {
  const status = getDueStatus(r)
  if (status === 'logged') return <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full whitespace-nowrap">✓ Done</span>
  const nextDue = getNextDueDate(r)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((nextDue.getTime() - today.getTime()) / 86400000)
  if (status === 'due')
    return <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full whitespace-nowrap">Due today</span>
  if (diff === 1)
    return <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full whitespace-nowrap">Tomorrow</span>
  return <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full whitespace-nowrap">In {diff}d</span>
}

export default function TransactionsPage() {
  const [month, setMonth] = useState(new Date())
  const [tab, setTab] = useState<'list' | 'chart' | 'recurring'>('list')
  const [showAdd, setShowAdd] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [showAddRecurring, setShowAddRecurring] = useState(false)
  const [editRecurring, setEditRecurring] = useState<RecurringTransaction | null>(null)
  const { accounts, addTransaction, updateTransaction, deleteTransaction } = useAccounts()
  const { transactions, forMonth, monthlyIncome, monthlyExpenses, categoryTotals } = useTransactions()
  const { expenseCategories, incomeCategories } = useCategories()
  const { recurring, addRecurring, updateRecurring, deleteRecurring } = useRecurring()

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
        <button
          onClick={() => tab === 'recurring' ? setShowAddRecurring(true) : setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Month picker — hidden on recurring tab */}
      {tab !== 'recurring' && (
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
      )}

      {/* Summary — hidden on recurring tab */}
      {tab !== 'recurring' && (
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
      )}

      {/* Tab toggle */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(['list', 'chart', 'recurring'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {t === 'list' ? 'Transactions' : t === 'chart' ? 'Spending Chart' : 'Recurring'}
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

      {/* Recurring tab */}
      {tab === 'recurring' && (
        <div className="space-y-3">
          {recurring.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-500">
              No recurring transactions yet. Add one to get started.
            </div>
          ) : (
            recurring.map(r => (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl w-9 h-9 flex items-center justify-center bg-slate-800 rounded-full shrink-0">{r.categoryIcon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{r.payee || r.categoryName}</p>
                    {dueBadge(r)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.categoryName} · {r.accountName}
                  </p>
                  <p className="text-xs text-slate-600">
                    {r.frequency === 'monthly' ? `Monthly · Day ${r.dayOfMonth}` : `Weekly · ${DOW_LABELS[r.dayOfWeek ?? 1]}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-sm font-semibold ${r.type === 'income' ? 'text-green-400' : 'text-slate-300'}`}>
                    {r.type === 'income' ? '+' : '-'}{formatCurrency(r.amount)}
                  </span>
                  {getDueStatus(r) !== 'logged' && (
                    <button
                      onClick={async () => {
                        const acc = accounts.find(a => a.id === r.accountId)
                        await addTransaction({
                          date: new Date(), amount: r.amount, type: r.type,
                          categoryName: r.categoryName, categoryIcon: r.categoryIcon, categoryColor: r.categoryColor,
                          accountId: r.accountId, accountName: acc?.name ?? r.accountName,
                          payee: r.payee, notes: r.notes,
                        })
                        updateRecurring(r.id, { lastLoggedAt: Timestamp.now() })
                      }}
                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors">
                      <Check size={11} /> Log
                    </button>
                  )}
                  <button onClick={() => setEditRecurring(r)} className="text-slate-600 hover:text-blue-400 transition-colors p-1">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteRecurring(r.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
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

      {(showAddRecurring || editRecurring) && (
        <AddRecurringModal
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          initial={editRecurring ?? undefined}
          onSave={async (data) => {
            if (editRecurring) await updateRecurring(editRecurring.id, data)
            else await addRecurring(data as any)
            setShowAddRecurring(false); setEditRecurring(null)
          }}
          onClose={() => { setShowAddRecurring(false); setEditRecurring(null) }}
        />
      )}
    </div>
  )
}

// ─── Add / Edit Recurring Modal ───────────────────────────────────────────────

function AddRecurringModal({ accounts, expenseCategories, incomeCategories, initial, onSave, onClose }: {
  accounts: Account[]
  expenseCategories: Category[]
  incomeCategories: Category[]
  initial?: RecurringTransaction
  onSave: (data: Omit<RecurringTransaction, 'id' | 'createdAt' | 'lastLoggedAt'>) => Promise<void>
  onClose: () => void
}) {
  const [type, setType]           = useState<'income' | 'expense'>(initial?.type ?? 'expense')
  const [payee, setPayee]         = useState(initial?.payee ?? '')
  const [amount, setAmount]       = useState(initial ? String(initial.amount) : '')
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>(initial?.frequency ?? 'monthly')
  const [dayOfMonth, setDayOfMonth] = useState(String(initial?.dayOfMonth ?? 1))
  const [dayOfWeek, setDayOfWeek]   = useState(initial?.dayOfWeek ?? 1)
  const [accountId, setAccountId]   = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [selectedCat, setSelectedCat] = useState<Category | null>(() => {
    if (!initial) return null
    const cats = initial.type === 'income' ? incomeCategories : expenseCategories
    return cats.find(c => c.name === initial.categoryName) ?? null
  })
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const cats = type === 'income' ? incomeCategories : expenseCategories
  const canSave = payee && amount && Number(amount) > 0 && accountId && selectedCat

  const handleTypeChange = (t: 'income' | 'expense') => {
    setType(t); setSelectedCat(null)
  }

  const handleSave = async () => {
    if (!canSave || !selectedCat) return
    setSaving(true)
    try {
      const acc = accounts.find(a => a.id === accountId)
      const data: Omit<RecurringTransaction, 'id' | 'createdAt' | 'lastLoggedAt'> = {
        payee, amount: Number(amount), type, frequency,
        categoryName: selectedCat.name, categoryIcon: selectedCat.icon, categoryColor: selectedCat.colorHex,
        accountId, accountName: acc?.name ?? '', notes,
      }
      if (frequency === 'monthly') data.dayOfMonth = Math.max(1, Math.min(31, Number(dayOfMonth) || 1))
      if (frequency === 'weekly')  data.dayOfWeek  = dayOfWeek
      await onSave(data)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 placeholder-slate-600'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl border border-slate-800 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div className="flex items-center gap-2">
            <Repeat size={16} className="text-blue-400" />
            <h2 className="text-lg font-bold">{initial ? 'Edit Recurring' : 'Add Recurring'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><Plus size={20} className="rotate-45" /></button>
        </div>
        <div className="p-5 space-y-5">

          {/* Type */}
          <div className="flex gap-2">
            {(['expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => handleTypeChange(t)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${type === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="bg-slate-800 rounded-xl p-4">
            <label className="text-xs text-slate-400 font-medium block mb-1">Amount (SGD)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
              placeholder="0.00" step="0.01" min="0"
              className="w-full bg-transparent text-3xl font-bold text-white outline-none placeholder-slate-600" />
          </div>

          {/* Payee + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Payee</label>
              <input value={payee} onChange={e => setPayee(e.target.value)} placeholder="e.g. Netflix"
                className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1.5">Account</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)} className={inputCls}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Frequency</label>
            <div className="flex gap-2 mb-3">
              {(['monthly', 'weekly'] as const).map(f => (
                <button key={f} onClick={() => setFrequency(f)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${frequency === f ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                  {f}
                </button>
              ))}
            </div>
            {frequency === 'monthly' ? (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1.5">Day of month</label>
                <input type="number" value={dayOfMonth} min="1" max="31"
                  onChange={e => setDayOfMonth(e.target.value)}
                  onKeyDown={e => ['e','E','+','-'].includes(e.key) && e.preventDefault()}
                  placeholder="1–31" className={inputCls} />
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-2">Day of week</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[1,2,3,4,5,6,0].map(d => (
                    <button key={d} onClick={() => setDayOfWeek(d)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${dayOfWeek === d ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                      {DOW_SHORT[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-2">Category</label>
            <div className="grid grid-cols-4 gap-2">
              {cats.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCat(cat)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-center transition-all ${selectedCat?.id === cat.id ? 'ring-2 ring-blue-500 bg-slate-800' : 'bg-slate-800 hover:bg-slate-700'}`}>
                  <span className="text-xl leading-none">{cat.icon}</span>
                  <span className="text-[10px] text-slate-300 leading-tight">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1.5">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional"
              className={inputCls} />
          </div>

          <button onClick={handleSave} disabled={!canSave || saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Recurring'}
          </button>
        </div>
      </div>
    </div>
  )
}
