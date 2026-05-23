import { useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Trophy, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { useAccounts } from '../hooks/useAccounts'
import { useTransactions } from '../hooks/useTransactions'
import { useInvestments } from '../hooks/useInvestments'
import { useCategories } from '../hooks/useCategories'
import { useCPF } from '../hooks/useCPF'
import { formatCurrency, monthLabel, addMonths } from '../lib/utils'
import AddTransactionModal from './modals/AddTransactionModal'
import { Transaction } from '../types'

type DashTab = 'month' | 'year' | 'alltime'

const CHART_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

// ─── helpers ────────────────────────────────────────────────────────────────

function isSameMonthYear(d: Date, ref: Date) {
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear()
}

function txDate(tx: Transaction): Date {
  return (tx.date as any)?.toDate ? (tx.date as any).toDate() : new Date(tx.date as any)
}

function useDashStats(transactions: Transaction[]) {
  const forMonth = (m: Date) => transactions.filter(t => isSameMonthYear(txDate(t), m))
  const income  = (txs: Transaction[]) => txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expenses = (txs: Transaction[]) => txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  const yearlyMonths = (year: number) =>
    Array.from({ length: 12 }, (_, i) => {
      const m = new Date(year, i, 1)
      const txs = transactions.filter(t => isSameMonthYear(txDate(t), m))
      const inc = income(txs)
      const exp = expenses(txs)
      return { label: m.toLocaleString('en-SG', { month: 'short' }), income: inc, expenses: exp, saved: inc - exp, month: m }
    })

  const catTotals = (txs: Transaction[]) => {
    const map: Record<string, { amount: number; color: string; icon: string }> = {}
    for (const t of txs.filter(t => t.type === 'expense')) {
      if (!map[t.categoryName]) map[t.categoryName] = { amount: 0, color: t.categoryColor, icon: t.categoryIcon }
      map[t.categoryName].amount += t.amount
    }
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
  }

  return { forMonth, income, expenses, yearlyMonths, catTotals }
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [tab, setTab]       = useState<DashTab>('month')
  const [month, setMonth]   = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)

  const { accounts, allocatedForAccount, bucketsForAccount, addTransaction } = useAccounts()
  const { transactions } = useTransactions()
  const { totalValue, totalCost, totalGainLoss, totalGainLossPct, investments } = useInvestments()
  const { expenseCategories, incomeCategories } = useCategories()
  const { totalCPF } = useCPF()

  const { forMonth, income, expenses, yearlyMonths, catTotals } = useDashStats(transactions)

  const totalAssets      = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + a.balance, 0)
  const netWorth         = totalAssets - totalLiabilities + totalValue + totalCPF

  const isCurrentMonth = isSameMonthYear(month, new Date())

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-3xl mx-auto">
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

      {/* Net worth — always visible */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5">
        <p className="text-blue-200 text-sm font-medium">Net Worth</p>
        <p className="text-4xl font-bold mt-1">{formatCurrency(netWorth)}</p>
        <div className="flex gap-5 mt-4 flex-wrap">
          <Stat label="Cash" value={formatCurrency(totalAssets)} color="text-green-300" />
          <Stat label="Invested" value={formatCurrency(totalValue)} color="text-purple-300" />
          {totalCPF > 0 && <Stat label="CPF" value={formatCurrency(totalCPF)} color="text-yellow-300" />}
          {totalLiabilities > 0 && <Stat label="Debt" value={formatCurrency(totalLiabilities)} color="text-red-300" />}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
        {([['month','Monthly'],['year','Yearly'],['alltime','All Time']] as [DashTab,string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── MONTH TAB ─────────────────────────────── */}
      {tab === 'month' && (
        <MonthTab
          month={month} isCurrentMonth={isCurrentMonth}
          onPrev={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month,  1))}
          transactions={transactions}
          forMonth={forMonth} income={income} expenses={expenses} catTotals={catTotals}
        />
      )}

      {/* ── YEAR TAB ──────────────────────────────── */}
      {tab === 'year' && (
        <YearTab
          yearlyMonths={yearlyMonths}
          income={income} expenses={expenses}
          transactions={transactions}
          catTotals={catTotals}
        />
      )}

      {/* ── ALL TIME TAB ──────────────────────────── */}
      {tab === 'alltime' && (
        <AllTimeTab
          transactions={transactions}
          accounts={accounts}
          investments={investments}
          totalValue={totalValue} totalCost={totalCost}
          totalGainLoss={totalGainLoss} totalGainLossPct={totalGainLossPct}
          totalAssets={totalAssets} totalLiabilities={totalLiabilities} netWorth={netWorth}
          totalCPF={totalCPF}
          income={income} expenses={expenses}
          allocatedForAccount={allocatedForAccount}
          bucketsForAccount={bucketsForAccount}
        />
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
    </div>
  )
}

// ─── Month Tab ───────────────────────────────────────────────────────────────

function MonthTab({ month, isCurrentMonth, onPrev, onNext, transactions, forMonth, income, expenses, catTotals }: {
  month: Date; isCurrentMonth: boolean
  onPrev: () => void; onNext: () => void
  transactions: Transaction[]
  forMonth: (m: Date) => Transaction[]
  income: (txs: Transaction[]) => number
  expenses: (txs: Transaction[]) => number
  catTotals: (txs: Transaction[]) => { name: string; amount: number; color: string; icon: string }[]
}) {
  const txs     = forMonth(month)
  const inc     = income(txs)
  const exp     = expenses(txs)
  const saved   = inc - exp
  const savingsRate = inc > 0 ? Math.min(100, Math.max(0, (saved / inc) * 100)) : 0
  const cats    = catTotals(txs)
  const recent  = txs.slice(0, 8)

  // group recent by day for display
  const grouped: { dateStr: string; dayTxs: Transaction[] }[] = []
  const seen = new Set<string>()
  for (const tx of txs) {
    const d = txDate(tx)
    const key = d.toDateString()
    if (!seen.has(key)) {
      seen.add(key)
      grouped.push({ dateStr: d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }), dayTxs: txs.filter(t => txDate(t).toDateString() === key) })
    }
  }

  return (
    <div className="space-y-4">
      {/* Month picker */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <button onClick={onPrev} className="text-slate-400 hover:text-white p-1 transition-colors"><ChevronLeft size={20} /></button>
        <span className="font-semibold">{monthLabel(month)}</span>
        <button onClick={onNext} disabled={isCurrentMonth} className="text-slate-400 hover:text-white disabled:opacity-30 p-1 transition-colors"><ChevronRight size={20} /></button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Income" value={inc} icon={<TrendingDown size={14} />} color="text-green-400" />
        <SummaryCard label="Expenses" value={exp} icon={<TrendingUp size={14} />} color="text-red-400" />
        <SummaryCard label="Saved" value={saved} icon={<Wallet size={14} />} color={saved >= 0 ? 'text-blue-400' : 'text-orange-400'} />
      </div>

      {/* Savings rate */}
      {inc > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-slate-300">Savings Rate</span>
            <span className={`text-sm font-bold ${savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>
              {savingsRate.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${savingsRate}%`, background: savingsRate >= 20 ? '#22c55e' : savingsRate >= 10 ? '#f59e0b' : '#ef4444' }} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {savingsRate >= 20 ? '🎉 Great savings habit!' : savingsRate >= 10 ? '👍 Decent — aim for 20%+' : '⚠️ Try to save more this month'}
          </p>
        </div>
      )}

      {/* Spending breakdown */}
      {cats.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-300">Spending Breakdown</h3>

          {/* Pie chart */}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={cats} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {cats.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>

          {/* Category bar list */}
          <div className="space-y-2.5">
            {cats.slice(0, 6).map((cat, i) => (
              <div key={cat.name} className="flex items-center gap-3">
                <span className="text-base w-6 text-center">{cat.icon}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{cat.name}</span>
                    <span className="font-semibold">{formatCurrency(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (cat.amount / exp) * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </div>
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">{((cat.amount / exp) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Transactions</h3>
        {grouped.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
            No transactions for {monthLabel(month)}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ dateStr, dayTxs }) => (
              <div key={dateStr}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">{dateStr}</p>
                <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
                  {dayTxs.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="text-lg w-8 h-8 flex items-center justify-center bg-slate-800 rounded-full shrink-0">{tx.categoryIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.payee || tx.categoryName}</p>
                        <p className="text-xs text-slate-500">{tx.categoryName} · {tx.accountName}</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ${tx.type === 'income' ? 'text-green-400' : ''}`}>
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Year Tab ────────────────────────────────────────────────────────────────

function YearTab({ yearlyMonths, income, expenses, transactions, catTotals }: {
  yearlyMonths: (year: number) => { label: string; income: number; expenses: number; saved: number; month: Date }[]
  income: (txs: Transaction[]) => number
  expenses: (txs: Transaction[]) => number
  transactions: Transaction[]
  catTotals: (txs: Transaction[]) => { name: string; amount: number; color: string; icon: string }[]
}) {
  const year = new Date().getFullYear()
  const months = yearlyMonths(year)
  const yearTxs = transactions.filter(t => txDate(t).getFullYear() === year)

  const annualIncome   = income(yearTxs)
  const annualExpenses = expenses(yearTxs)
  const annualSaved    = annualIncome - annualExpenses
  const savingsRate    = annualIncome > 0 ? Math.min(100, (annualSaved / annualIncome) * 100) : 0

  const withData = months.filter(m => m.income > 0 || m.expenses > 0)
  const bestMonth  = withData.length ? withData.reduce((a, b) => b.saved > a.saved ? b : a) : null
  const worstMonth = withData.length ? withData.reduce((a, b) => b.expenses > a.expenses ? b : a) : null

  const cats = catTotals(yearTxs)

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">{year} Overview</h2>

      {/* Annual summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Annual Income</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(annualIncome)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Annual Expenses</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(annualExpenses)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total Saved</p>
          <p className={`text-lg font-bold ${annualSaved >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>{formatCurrency(annualSaved)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Savings Rate</p>
          <p className={`text-lg font-bold ${savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>{savingsRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* Best / worst callouts */}
      {(bestMonth || worstMonth) && (
        <div className="grid grid-cols-2 gap-3">
          {bestMonth && bestMonth.saved > 0 && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 text-green-400 text-xs font-semibold mb-1"><Trophy size={12} /> Best Month</div>
              <p className="text-sm font-bold">{bestMonth.label}</p>
              <p className="text-xs text-slate-400">Saved {formatCurrency(bestMonth.saved)}</p>
            </div>
          )}
          {worstMonth && worstMonth.expenses > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 text-red-400 text-xs font-semibold mb-1"><AlertCircle size={12} /> Most Spending</div>
              <p className="text-sm font-bold">{worstMonth.label}</p>
              <p className="text-xs text-slate-400">Spent {formatCurrency(worstMonth.expenses)}</p>
            </div>
          )}
        </div>
      )}

      {/* Month-by-month bar chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Income vs Expenses by Month</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={months} barCategoryGap="20%" barGap={2}>
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} width={36} />
            <Tooltip
              formatter={(v: number, name: string) => [formatCurrency(v), name === 'income' ? 'Income' : 'Expenses']}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }}
            />
            <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-center">
          <LegendDot color="#22c55e" label="Income" />
          <LegendDot color="#ef4444" label="Expenses" />
        </div>
      </div>

      {/* Top categories for year */}
      {cats.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Top Spending Categories ({year})</h3>
          {cats.slice(0, 8).map((cat, i) => (
            <div key={cat.name} className="flex items-center gap-3">
              <span className="text-base w-6 text-center">{cat.icon}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300">{cat.name}</span>
                  <span className="font-semibold">{formatCurrency(cat.amount)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (cat.amount / annualExpenses) * 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                </div>
              </div>
              <span className="text-xs text-slate-500 w-8 text-right">{((cat.amount / annualExpenses) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── All Time Tab ─────────────────────────────────────────────────────────────

function AllTimeTab({ transactions, accounts, investments, totalValue, totalCost, totalGainLoss, totalGainLossPct, totalAssets, totalLiabilities, netWorth, totalCPF, income, expenses, allocatedForAccount, bucketsForAccount }: {
  transactions: Transaction[]
  accounts: any[]; investments: any[]
  totalValue: number; totalCost: number; totalGainLoss: number; totalGainLossPct: number
  totalAssets: number; totalLiabilities: number; netWorth: number; totalCPF: number
  income: (txs: Transaction[]) => number
  expenses: (txs: Transaction[]) => number
  allocatedForAccount: (id: string) => number
  bucketsForAccount: (id: string) => any[]
}) {
  const allIncome   = income(transactions)
  const allExpenses = expenses(transactions)
  const allSaved    = allIncome - allExpenses
  const savingsRate = allIncome > 0 ? Math.min(100, (allSaved / allIncome) * 100) : 0

  const bankAccounts   = accounts.filter(a => a.type !== 'credit')
  const creditAccounts = accounts.filter(a => a.type === 'credit')

  const netWorthPie = [
    { name: 'Cash & Savings', value: totalAssets, color: '#22c55e' },
    { name: 'Investments', value: totalValue, color: '#8b5cf6' },
    totalCPF > 0 ? { name: 'CPF', value: totalCPF, color: '#f59e0b' } : null,
    totalLiabilities > 0 ? { name: 'Debt (owed)', value: totalLiabilities, color: '#ef4444' } : null,
  ].filter(Boolean) as { name: string; value: number; color: string }[]

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold">All Time Summary</h2>

      {/* Lifetime stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total Income</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(allIncome)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total Expenses</p>
          <p className="text-lg font-bold text-red-400">{formatCurrency(allExpenses)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Lifetime Saved</p>
          <p className={`text-lg font-bold ${allSaved >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>{formatCurrency(allSaved)}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Avg Savings Rate</p>
          <p className={`text-lg font-bold ${savingsRate >= 20 ? 'text-green-400' : savingsRate >= 10 ? 'text-yellow-400' : 'text-red-400'}`}>{savingsRate.toFixed(0)}%</p>
        </div>
      </div>

      {/* Net worth breakdown pie */}
      {netWorthPie.some(d => d.value > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Net Worth Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={netWorthPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {netWorthPie.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-1">
            {netWorthPie.map(d => <LegendDot key={d.name} color={d.color} label={`${d.name}: ${formatCurrency(d.value)}`} />)}
          </div>
        </div>
      )}

      {/* Accounts */}
      {bankAccounts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300">Bank Accounts</h3>
          </div>
          {bankAccounts.map(acc => {
            const allocated = allocatedForAccount(acc.id)
            const buckets = bucketsForAccount(acc.id)
            return (
              <div key={acc.id} className="px-4 py-3 border-b border-slate-800 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: acc.colorHex }} />
                    <div>
                      <p className="text-sm font-semibold">{acc.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{acc.institution || acc.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(acc.balance)}</p>
                    {allocated > 0 && <p className="text-xs text-slate-500">{formatCurrency(acc.balance - allocated)} free</p>}
                  </div>
                </div>
                {buckets.length > 0 && (
                  <div className="mt-2 pl-5 space-y-1">
                    {buckets.map((b: any) => (
                      <div key={b.id} className="flex justify-between text-xs text-slate-400">
                        <span>• {b.name}</span>
                        <span>{formatCurrency(b.allocatedAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Credit cards */}
      {creditAccounts.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300">Credit Cards</h3>
          </div>
          {creditAccounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800 last:border-0">
              <div>
                <p className="text-sm font-semibold">{acc.name}</p>
                <p className="text-xs text-slate-500">{acc.institution}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-400">{formatCurrency(acc.balance)}</p>
                <p className="text-xs text-red-400">owed</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Investment portfolio */}
      {investments.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Investments</h3>
            <span className={`text-xs font-semibold ${totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)} ({totalGainLossPct >= 0 ? '+' : ''}{totalGainLossPct.toFixed(1)}%)
            </span>
          </div>
          {investments.map((inv: any) => (
            <div key={inv.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-800 last:border-0">
              <div>
                <p className="text-sm font-semibold">{inv.ticker}</p>
                <p className="text-xs text-slate-500">{inv.shares} shares</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{formatCurrency(inv.shares * inv.currentPrice)}</p>
                <p className={`text-xs ${(inv.currentPrice - inv.purchasePrice) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {((inv.currentPrice - inv.purchasePrice) / inv.purchasePrice * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 border-t border-slate-800 bg-slate-800/30">
            <span className="text-sm font-semibold">Total</span>
            <span className="text-sm font-bold">{formatCurrency(totalValue)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared small components ──────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="text-blue-200 text-xs">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${color}`}>{icon}{label}</div>
      <p className={`font-bold text-sm ${color}`}>{formatCurrency(value)}</p>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      {label}
    </div>
  )
}
